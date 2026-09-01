import mongoose from "mongoose";
import { notFound, forbidden, badRequest } from "../../utils/errors.js";
import Conversation from "../../models/Conversation.js";
import Message from "../../models/Message.js";
import User from "../../models/User.js";
import GameMatch from "./game.model.js";
import { pickRandomPrompt } from "./prompts.js";
import { emitToConversation } from "../../socket/io.js";
import { publicMessage } from "../messages/messages.service.js";

// In-memory game state keyed by matchId (same pattern as presence tracking)
export const gameStates = new Map();

function toPublicMatch(doc) {
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    id: obj._id.toString(),
    type: obj.type,
    conversationId: obj.conversationId.toString(),
    players: (obj.players || []).map((p) => ({
      userId: p.userId.toString(),
      wpm: p.wpm,
      accuracy: p.accuracy,
      finishedAt: p.finishedAt,
      rank: p.rank,
      // enriched fields injected later when available
      displayName: p.displayName || null,
      username: p.username || null,
    })),
    textPrompt: obj.textPrompt,
    status: obj.status,
    startedAt: obj.startedAt,
    endedAt: obj.endedAt,
    createdBy: obj.createdBy ? obj.createdBy.toString() : null,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

async function enrichMatch(matchDoc) {
  try {
    const ids = (matchDoc.players || []).map((p) => p.userId);
    if (!ids.length) return toPublicMatch(matchDoc);
    const users = await User.find({ _id: { $in: ids } }).select("displayName username").lean();
    const map = new Map(users.map((u) => [u._id.toString(), u]));
    const obj = matchDoc.toObject ? matchDoc.toObject() : matchDoc;
    const enrichedPlayers = (obj.players || []).map((p) => {
      const u = map.get(p.userId.toString());
      return {
        userId: p.userId.toString(),
        wpm: p.wpm,
        accuracy: p.accuracy,
        finishedAt: p.finishedAt,
        rank: p.rank,
        displayName: u?.displayName || null,
        username: u?.username || null,
      };
    });
    const pub = toPublicMatch(matchDoc);
    pub.players = enrichedPlayers;
    return pub;
  } catch {
    return toPublicMatch(matchDoc);
  }
}

function initGameState(match, participantIds) {
  const matchId = match._id.toString();
  if (gameStates.has(matchId)) return gameStates.get(matchId);
  const state = {
    matchId,
    conversationId: match.conversationId.toString(),
    textPrompt: match.textPrompt,
    promptLength: match.textPrompt.length,
    status: match.status, // pending | active | completed
    participantIds: participantIds.map((id) => id.toString()),
    joined: new Set(),
    // progress per userId: charsTyped
    progress: new Map(),
    // finished results per userId
    finished: new Map(),
    rankCounter: 1,
    startedAt: match.startedAt || null,
  };
  gameStates.set(matchId, state);
  return state;
}

export function getGameState(matchId) {
  return gameStates.get(String(matchId)) || null;
}

export async function createTypingRaceInvite({ conversationId, userId }) {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw badRequest("Invalid conversationId", "INVALID_CONVERSATION");
  }
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw notFound("Conversation not found", "CONVERSATION_NOT_FOUND");
  }
  const participantIds = conversation.participants.map((p) => p.toString());
  if (!participantIds.includes(userId)) {
    throw forbidden("You are not a participant of this conversation", "NOT_PARTICIPANT");
  }

  const textPrompt = pickRandomPrompt();

  const match = await GameMatch.create({
    type: "typing_race",
    conversationId,
    players: participantIds.map((pid) => ({ userId: pid, wpm: null, accuracy: null, finishedAt: null, rank: null })),
    textPrompt,
    status: "pending",
    createdBy: userId,
  });

  // init in-memory state
  initGameState(match, participantIds);

  // Persist a lightweight inline card via existing message event pipeline.
  // Use type game_invite so frontend can render TypingRaceInviteCard.
  const inviteMsg = await Message.create({
    conversationId,
    senderId: userId,
    content: `Typing race invited — ${textPrompt.slice(0, 48)}...`,
    type: "game_invite",
    gameMatchId: match._id,
    gameType: "typing_race",
  });
  await Conversation.findByIdAndUpdate(conversationId, { lastMessageAt: inviteMsg.createdAt });

  const payload = publicMessage(inviteMsg);
  // ensure game fields surface in payload
  payload.gameMatchId = match._id.toString();
  payload.gameType = "typing_race";
  payload.matchId = match._id.toString();
  emitToConversation(conversationId, "message:new", payload);

  // also emit a dedicated game event for clients that listen directly
  emitToConversation(conversationId, "game:invite", {
    match: toPublicMatch(match),
    message: payload,
  });

  return { match: toPublicMatch(match), message: payload };
}

export async function getMatch(matchId) {
  if (!mongoose.Types.ObjectId.isValid(matchId)) throw badRequest("Invalid matchId", "INVALID_MATCH");
  const match = await GameMatch.findById(matchId);
  if (!match) throw notFound("Match not found", "MATCH_NOT_FOUND");
  return enrichMatch(match);
}

export async function listMatchesForUser({ userId, limit = 20 }) {
  const docs = await GameMatch.find({ "players.userId": userId })
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 50));
  const enriched = await Promise.all(docs.map((d) => enrichMatch(d)));
  return enriched;
}

export async function handleRaceFinish({ matchId, userId, wpm, accuracy }) {
  const match = await GameMatch.findById(matchId);
  if (!match) throw notFound("Match not found", "MATCH_NOT_FOUND");
  if (match.status === "completed") return toPublicMatch(match);

  // assign rank by arrival order among not-yet-finished players
  const already = match.players.find((p) => p.userId.toString() === userId && p.rank);
  if (already) {
    return toPublicMatch(match);
  }

  // find player entry
  let entry = match.players.find((p) => p.userId.toString() === userId);
  if (!entry) {
    // if user not in original participant list, still allow but push?
    match.players.push({ userId, wpm, accuracy, finishedAt: new Date(), rank: null });
    entry = match.players[match.players.length - 1];
  }

  // rank = count of existing ranked +1
  const rankedCount = match.players.filter((p) => p.rank).length;
  entry.wpm = wpm;
  entry.accuracy = accuracy;
  entry.finishedAt = new Date();
  entry.rank = rankedCount + 1;

  // if all players finished OR at least one finished and we want to keep completed after all? We'll mark completed when all have rank, OR when first finisher maybe? Spec says server assigns rank by order of arrival, marks match completed, persists summary. Could be on each finish check if all done then completed.
  const allFinished = match.players.every((p) => p.rank);
  if (allFinished) {
    match.status = "completed";
    match.endedAt = new Date();
  } else {
    // if status still pending, move to active
    if (match.status === "pending") {
      match.status = "active";
      match.startedAt = match.startedAt || new Date();
    }
  }

  await match.save();

  // update in-memory
  const state = gameStates.get(String(matchId));
  if (state) {
    state.finished.set(String(userId), { wpm, accuracy, rank: entry.rank, finishedAt: entry.finishedAt });
    if (allFinished) {
      state.status = "completed";
      state.endedAt = match.endedAt;
    } else {
      state.status = match.status;
    }
  }

  const enriched = await enrichMatch(match);

  // emit final result to conversation so invite cards morph to finished state even for non-joined viewers
  if (allFinished) {
    try {
      emitToConversation(match.conversationId.toString(), "game:completed", {
        matchId: match._id.toString(),
        match: enriched,
        results: enriched.players,
      });
      emitToConversation(match.conversationId.toString(), "game:update", {
        matchId: match._id.toString(),
        match: enriched,
      });
    } catch {}
  } else {
    try {
      emitToConversation(match.conversationId.toString(), "game:update", {
        matchId: match._id.toString(),
        match: enriched,
      });
    } catch {}
  }

  return enriched;
}
