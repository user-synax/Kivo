import mongoose from "mongoose";
import { forbidden, notFound, badRequest, conflict } from "../../utils/errors.js";
import Conversation from "../../models/Conversation.js";
import Message from "../../models/Message.js";
import User from "../../models/User.js";
import Space from "../../models/Space.js";
import GameSession from "../../models/GameSession.js";
import { getRequesterPlan } from "../../lib/plus.js";
import { emitToConversation, emitToUser } from "../../socket/io.js";
import { publicMessage } from "../messages/messages.service.js";
import { createOrGetDm } from "../conversations/conversations.service.js";
import * as notificationsService from "../notifications/notifications.service.js";

// Kivo Games — server-authoritative game sessions.
//
// Games are played in the full-screen arena at /games. A session is 1v1: you
// invite someone from the arena, the backend reuses (or creates) your DM, and a
// thin "chip" message is posted there so the invite and the result are visible
// in chat. Chat is never the play surface.
//
// Trust model: the server picks the passage, stamps the start time, derives WPM
// from its own clock, and assigns finish places. Clients only report "I typed
// this far" and "I finished" — the same never-trust-the-client rule used across
// the API.

const PASSAGES = [
  "The quick brown fox jumps over the lazy dog while the curious cat watches from a sunny windowsill.",
  "Every morning the city wakes slowly, first with the rumble of buses and then with the chatter of people.",
  "A good conversation is like a long walk through a familiar town, full of small turns you did not expect.",
  "Learning to type quickly is mostly about rhythm, not speed, because steady hands beat hurried ones every time.",
  "Rain tapped against the window as she poured another cup of tea and listened to the quiet house settle.",
  "The best ideas rarely arrive on schedule, so it helps to keep a notebook close and your patience closer.",
];

const MIN_PLAYERS = 2;
// Safety net for an *abandoned* race. An actively-typed race extends this on
// every progress ping (see reportProgress), so a slow typist is never cut off —
// only a race nobody is playing gets reaped.
const RACE_DEADLINE_MS = 10 * 60 * 1000;
const INVITE_TTL_MS = 30 * 60 * 1000; // a pending invite expires after 30 minutes
const MAX_SANE_WPM = 400; // guards against absurd values from a near-zero elapsed time

const KIND_LABELS = Object.freeze({ typing: "Typing Race" });

function kindLabel(kind) {
  return KIND_LABELS[kind] || "Game";
}

function pickPassage() {
  return PASSAGES[Math.floor(Math.random() * PASSAGES.length)];
}

// WPM = (characters / 5) / minutes, from the passage and the server's own clock.
function computeWpm(passage, elapsedMs) {
  if (!passage || !elapsedMs || elapsedMs <= 0) return null;
  const minutes = elapsedMs / 60000;
  const wpm = passage.trim().length / 5 / minutes;
  if (!Number.isFinite(wpm)) return null;
  return Math.min(MAX_SANE_WPM, Math.max(0, Math.round(wpm)));
}

async function assertMembership(conversationId, userId) {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw notFound("Conversation not found", "CONVERSATION_NOT_FOUND");
  const participantIds = conversation.participants.map((p) => p.toString());
  if (!participantIds.includes(String(userId))) {
    throw forbidden("You are not a participant of this conversation", "NOT_PARTICIPANT");
  }
  return conversation;
}

// Blocking is enforced both ways (mirrors the DM messaging rule).
async function assertDmNotBlocked(conversation, userId) {
  if (conversation.type !== "dm") return;
  const others = conversation.participants
    .map((p) => p.toString())
    .filter((id) => id !== String(userId));
  if (others.length === 0) return;
  const me = await User.findById(userId).select("blockedUsers").lean();
  const iBlockedThem = (me?.blockedUsers || []).some((id) => others.includes(id.toString()));
  if (iBlockedThem) throw forbidden("You cannot start a game with this user", "BLOCKED_USER");
  const theyBlockedMe = await User.exists({
    _id: { $in: others },
    blockedUsers: new mongoose.Types.ObjectId(userId),
  });
  if (theyBlockedMe) throw forbidden("You cannot start a game with this user", "BLOCKED_USER");
}

async function loadSession(gameId) {
  if (!mongoose.Types.ObjectId.isValid(gameId)) {
    throw badRequest("Invalid game id", "INVALID_ID");
  }
  const session = await GameSession.findById(gameId);
  if (!session) throw notFound("Game not found", "GAME_NOT_FOUND");
  return session;
}

// Client-safe player list. Every emit that carries players uses this shape, so a
// client can safely replace its local copy — a partial shape would silently drop
// `status` and make the UI think the player had left the race.
export function publicPlayers(session) {
  return (session.players || []).map((p) => ({
    userId: p.userId.toString(),
    displayName: p.displayName || null,
    status: p.status,
    progress: p.progress || 0,
    place: p.place ?? null,
    wpm: p.wpm ?? null,
    accuracy: p.accuracy ?? null,
    elapsedMs: p.elapsedMs ?? null,
    finishedAt: p.finishedAt ? new Date(p.finishedAt).toISOString() : null,
  }));
}

// Public (client-safe) view of a session. The passage is only revealed once the
// race is active — and only to people who can see the conversation.
export function publicGame(session, { includePassage = false } = {}) {
  const view = {
    id: session._id.toString(),
    kind: session.kind,
    status: session.status,
    conversationId: session.conversationId.toString(),
    messageId: session.messageId ? session.messageId.toString() : null,
    createdBy: session.createdBy.toString(),
    players: publicPlayers(session),
    startedAt: session.startedAt ? new Date(session.startedAt).toISOString() : null,
    finishedAt: session.finishedAt ? new Date(session.finishedAt).toISOString() : null,
    expiresAt: session.expiresAt ? new Date(session.expiresAt).toISOString() : null,
    winnerId: session.winnerId ? session.winnerId.toString() : null,
  };
  if (includePassage) view.passage = session.passage || null;
  return view;
}

// Snapshot embedded on a chat chip message (see Message.game). `role` separates
// the session card created at invite time from the result card shared when the
// race concludes.
function buildCard(session, role = "invite") {
  const winner = (session.players || []).find(
    (p) => session.winnerId && p.userId.toString() === session.winnerId.toString(),
  );
  return {
    sessionId: session._id,
    kind: session.kind,
    role,
    status: session.status,
    players: (session.players || []).map((p) => ({
      userId: p.userId,
      displayName: p.displayName || null,
      status: p.status,
      place: p.place ?? null,
      wpm: p.wpm ?? null,
      accuracy: p.accuracy ?? null,
      elapsedMs: p.elapsedMs ?? null,
    })),
    winnerId: session.winnerId || null,
    winnerName: winner?.displayName || null,
    startedAt: session.startedAt || null,
    finishedAt: session.finishedAt || null,
  };
}

// Persist the chip snapshot and announce it as a message edit so the chip flips
// between invite → live → result on every client without a refetch.
async function syncCard(session) {
  if (!session.messageId) return;
  const message = await Message.findById(session.messageId);
  if (!message) return;
  message.game = buildCard(session, "invite");
  message.markModified("game");
  await message.save();
  emitToConversation(
    session.conversationId.toString(),
    "message:edited",
    publicMessage(message, null),
  );
}

// Share the outcome of a race as its own chat chip. This is a NEW message rather
// than an edit of the invite card, so the conclusion lands as a fresh entry with
// its own notification and unread badge — and never posts twice on a retry.
async function postResultChip(session) {
  if (session.resultMessageId) return null;

  const winner = (session.players || []).find(
    (p) => session.winnerId && p.userId.toString() === session.winnerId.toString(),
  );
  const winnerName = winner?.displayName || "Someone";
  const wpm = winner?.wpm;
  const summary = `${kindLabel(session.kind)} — ${winnerName} won${
    Number.isFinite(wpm) ? ` (${wpm} wpm)` : ""
  }`;

  const message = await Message.create({
    conversationId: session.conversationId,
    // Attributed to the winner so the resulting notification reads as their
    // result (and the other player is the one notified).
    senderId: session.winnerId || session.createdBy,
    content: summary,
    type: "game",
    game: buildCard(session, "result"),
    replyToMessageId: null,
    threadId: null,
    mentions: [],
    attachments: [],
    audioDuration: null,
  });
  session.resultMessageId = message._id;
  await session.save();

  await Conversation.findByIdAndUpdate(session.conversationId, {
    lastMessageAt: message.createdAt,
  });

  emitToConversation(
    session.conversationId.toString(),
    "message:new",
    publicMessage(message, null),
  );

  try {
    const conversation = await Conversation.findById(session.conversationId);
    if (conversation) {
      notificationsService
        .createForMessage({ message, conversation, inThread: false })
        .catch((err) =>
          console.error("[games] result notification failed:", err?.message || err),
        );
    }
  } catch (err) {
    console.error("[games] result notify lookup failed:", err?.message || err);
  }

  return message;
}

// Turn a pending session into a running race. Shared by the manual start (host)
// and the auto-start that fires the moment a 1v1 invite is accepted.
async function activateSession(session) {
  session.status = "active";
  session.passage = pickPassage();
  session.startedAt = new Date();
  session.expiresAt = new Date(Date.now() + RACE_DEADLINE_MS);
  session.winnerId = null;
  for (const p of session.players) {
    p.progress = 0;
    p.place = null;
    p.wpm = null;
    p.accuracy = null;
    p.elapsedMs = null;
    p.finishedAt = null;
  }
  await session.save();
  await syncCard(session);
  emitToConversation(
    session.conversationId.toString(),
    "game:started",
    publicGame(session, { includePassage: true }),
  );
  return publicGame(session, { includePassage: true });
}

// Invite someone to play. Reuses (or creates) the DM, so the resulting chat chip
// has a natural home — and so both players share a socket room for realtime.
export async function inviteToGame({ userId, targetUserId, kind = "typing" }) {
  if (!targetUserId || String(targetUserId) === String(userId)) {
    throw badRequest("Pick someone to play with", "SELF_INVITE");
  }
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    throw badRequest("Invalid player", "INVALID_PLAYER");
  }

  const target = await User.findById(targetUserId).select("displayName username").lean();
  if (!target) throw notFound("Player not found", "USER_NOT_FOUND");

  // Per-plan cap on concurrent sessions, server-side (client never trusted).
  const { limits } = await getRequesterPlan(User, userId);
  const open = await GameSession.countDocuments({
    status: { $in: ["pending", "active"] },
    "players.userId": userId,
  });
  if (open >= limits.gamesPerConversationActive) {
    throw forbidden(
      `You already have ${limits.gamesPerConversationActive} game${limits.gamesPerConversationActive === 1 ? "" : "s"} going — finish one first`,
      "GAME_LIMIT",
    );
  }

  // Reuse the DM (created if this pair has never chatted).
  const dm = await createOrGetDm({ userId, participantId: String(targetUserId) });
  const conversation = await Conversation.findById(dm.id);
  if (!conversation) throw notFound("Conversation not found", "CONVERSATION_NOT_FOUND");
  await assertDmNotBlocked(conversation, userId);

  // One live game per pair keeps the arena list unambiguous.
  const existing = await GameSession.findOne({
    conversationId: conversation._id,
    status: { $in: ["pending", "active"] },
  });
  if (existing) {
    throw conflict("There's already a game going with this player", "GAME_EXISTS");
  }

  const me = await User.findById(userId).select("displayName username").lean();

  const session = await GameSession.create({
    kind,
    status: "pending",
    conversationId: conversation._id,
    createdBy: userId,
    players: [
      {
        userId,
        displayName: me?.displayName || me?.username || "Player",
        status: "joined",
      },
      {
        userId: targetUserId,
        displayName: target.displayName || target.username || "Player",
        status: "invited",
      },
    ],
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });

  // The chip lives in the conversation: it drives the unread badge, the
  // notification, and the push — while the game itself plays at /games.
  const message = await Message.create({
    conversationId: conversation._id,
    senderId: userId,
    content: `${kindLabel(kind)} invite`,
    type: "game",
    game: buildCard(session),
    replyToMessageId: null,
    threadId: null,
    mentions: [],
    attachments: [],
    audioDuration: null,
  });
  session.messageId = message._id;
  await session.save();

  await Conversation.findByIdAndUpdate(conversation._id, { lastMessageAt: message.createdAt });

  emitToConversation(conversation._id.toString(), "message:new", publicMessage(message, userId));
  emitToConversation(conversation._id.toString(), "game:updated", publicGame(session));
  // A dedicated nudge so an open arena can surface the invite immediately.
  emitToUser(targetUserId, "game:invited", publicGame(session));
  notificationsService
    .createForMessage({ message, conversation, inThread: false })
    .catch((err) => console.error("[games] notification failed:", err?.message || err));

  return publicGame(session);
}

// Accept an invite. A 1v1 race starts the instant both players are in, so
// accepting is the whole handshake — no separate "start" step.
export async function joinGame({ gameId, userId }) {
  const session = await loadSession(gameId);
  await assertMembership(session.conversationId.toString(), userId);
  if (session.status === "active") {
    return publicGame(session, { includePassage: true });
  }
  if (session.status !== "pending") {
    throw badRequest("This game already finished", "GAME_NOT_PENDING");
  }

  const player = session.players.find((p) => p.userId.toString() === String(userId));
  if (!player) throw forbidden("You were not invited to this game", "NOT_INVITED");
  if (player.status === "joined") return publicGame(session);

  player.status = "joined";
  await session.save();

  const joined = session.players.filter((p) => p.status === "joined");
  // Auto-start as soon as everyone invited is in.
  if (joined.length >= MIN_PLAYERS && joined.length === session.players.length) {
    return activateSession(session);
  }

  await syncCard(session);
  emitToConversation(session.conversationId.toString(), "game:updated", publicGame(session));
  return publicGame(session);
}

export async function declineGame({ gameId, userId }) {
  const session = await loadSession(gameId);
  await assertMembership(session.conversationId.toString(), userId);
  if (session.status !== "pending") return publicGame(session);

  const player = session.players.find((p) => p.userId.toString() === String(userId));
  if (!player) throw forbidden("You were not invited to this game", "NOT_INVITED");
  player.status = "declined";
  player.progress = 0;
  await session.save();
  await syncCard(session);
  emitToConversation(session.conversationId.toString(), "game:updated", publicGame(session));
  return publicGame(session);
}

// Manual start — still available to the host if the invitee already accepted but
// the race has not begun (e.g. a re-opened arena).
export async function startGame({ gameId, userId }) {
  const session = await loadSession(gameId);
  await assertMembership(session.conversationId.toString(), userId);
  if (session.createdBy.toString() !== String(userId)) {
    throw forbidden("Only the host can start the race", "NOT_HOST");
  }
  if (session.status === "active") return publicGame(session, { includePassage: true });
  if (session.status !== "pending") throw badRequest("This game is no longer pending", "GAME_NOT_PENDING");

  const joined = session.players.filter((p) => p.status === "joined");
  if (joined.length < MIN_PLAYERS) {
    throw badRequest("Your opponent has not accepted yet", "GAME_NEED_PLAYERS");
  }
  return activateSession(session);
}

// Live progress ping. Monotonic and broadcast-only — never written to the chip
// message — so typing does not hammer the database.
export async function reportProgress({ gameId, userId, progress }) {
  const session = await loadSession(gameId);
  await assertMembership(session.conversationId.toString(), userId);
  if (session.status !== "active") throw badRequest("Race is not active", "GAME_NOT_ACTIVE");

  const player = session.players.find(
    (p) => p.userId.toString() === String(userId) && p.status === "joined",
  );
  if (!player) throw forbidden("Join the race first", "NOT_IN_GAME");

  const next = Math.max(player.progress || 0, Math.min(1, Number(progress) || 0));
  if (next === (player.progress || 0)) return { ok: true };

  player.progress = next;
  // Keep an actively-typed race alive: the deadline is a safety net for an
  // abandoned session, not a countdown that can cut a slow typist off mid-race.
  session.expiresAt = new Date(Date.now() + RACE_DEADLINE_MS);
  await session.save();
  emitToConversation(session.conversationId.toString(), "game:progress", {
    gameId: session._id.toString(),
    conversationId: session.conversationId.toString(),
    // Full player shape — clients replace their copy wholesale.
    players: publicPlayers(session),
  });
  return { ok: true };
}

export async function finishGame({ gameId, userId, accuracy, elapsedMs }) {
  const session = await loadSession(gameId);
  await assertMembership(session.conversationId.toString(), userId);

  const player = session.players.find(
    (p) => p.userId.toString() === String(userId) && p.status === "joined",
  );
  if (!player) throw forbidden("Join the race first", "NOT_IN_GAME");
  // Idempotent — a retry must not claim two places.
  if (player.finishedAt) return publicGame(session);
  // The race already concluded (the opponent crossed the line first). Return the
  // authoritative result rather than erroring on a near-simultaneous finish.
  if (session.status !== "active") return publicGame(session);

  const startedAtMs = session.startedAt ? new Date(session.startedAt).getTime() : Date.now();
  const serverElapsed = Math.max(0, Date.now() - startedAtMs);
  // Clamp the client's elapsed to what the server observed.
  const claimed = Number(elapsedMs);
  const elapsed = Number.isFinite(claimed) && claimed > 0
    ? Math.min(claimed, serverElapsed)
    : serverElapsed;

  const finishedCount = session.players.filter((p) => p.finishedAt).length;
  player.place = finishedCount + 1;
  player.elapsedMs = elapsed;
  player.wpm = computeWpm(session.passage, elapsed);
  player.accuracy = Number.isFinite(Number(accuracy))
    ? Math.round(Number(accuracy) * 10) / 10
    : null;
  player.finishedAt = new Date();
  player.progress = 1;
  if (player.place === 1) session.winnerId = player.userId;

  // Crossing the line finishes the race. In a 1v1 there is nothing left to wait
  // for, so the winner is decided and the result is shared right away instead of
  // leaving the finisher on a "waiting for your opponent" screen.
  session.status = "finished";
  session.finishedAt = new Date();

  await session.save();
  await syncCard(session);
  await postResultChip(session);
  emitToConversation(session.conversationId.toString(), "game:finished", publicGame(session));
  return publicGame(session);
}

export async function cancelGame({ gameId, userId }) {
  const session = await loadSession(gameId);
  await assertMembership(session.conversationId.toString(), userId);
  if (session.createdBy.toString() !== String(userId)) {
    throw forbidden("Only the host can cancel this game", "NOT_HOST");
  }
  if (session.status === "finished" || session.status === "cancelled") {
    return publicGame(session);
  }
  session.status = "cancelled";
  session.finishedAt = new Date();
  await session.save();
  await syncCard(session);
  emitToConversation(session.conversationId.toString(), "game:cancelled", publicGame(session));
  return publicGame(session);
}

export async function getGame({ gameId, userId }) {
  const session = await loadSession(gameId);
  await assertMembership(session.conversationId.toString(), userId);
  // Reveal the passage only while a race is actually running.
  return publicGame(session, { includePassage: session.status === "active" });
}

// Arena: pending invites waiting on me.
export async function listInvites({ userId }) {
  const sessions = await GameSession.find({
    status: "pending",
    players: { $elemMatch: { userId, status: "invited" } },
  })
    .sort({ createdAt: -1 })
    .limit(20);
  return sessions.map((s) => publicGame(s));
}

// Arena: games I am currently part of (waiting or racing).
export async function listMyGames({ userId }) {
  const sessions = await GameSession.find({
    status: { $in: ["pending", "active"] },
    "players.userId": userId,
  })
    .sort({ createdAt: -1 })
    .limit(20);
  return sessions.map((s) => publicGame(s));
}

// Sweep: pending invites and running races past their deadline are cancelled so
// chips never sit in a stale state. Mirrors closeExpiredPolls().
export async function abandonStaleGames() {
  const now = new Date();
  const stale = await GameSession.find({
    status: { $in: ["pending", "active"] },
    expiresAt: { $ne: null, $lte: now },
  }).limit(200);

  for (const session of stale) {
    session.status = "cancelled";
    session.finishedAt = now;
    await session.save();
    await syncCard(session);
    emitToConversation(
      session.conversationId.toString(),
      "game:cancelled",
      publicGame(session),
    );
  }
  return stale.length;
}
