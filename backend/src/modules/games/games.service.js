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
import {
  ARENA_LEADERBOARD_SIZE,
  arenaWeekEndsAt,
  arenaWeekKey,
  botProgressAt,
  canRecordRunnerUpFinish,
  COUNTDOWN_MS,
  INVITE_TTL_MS,
  isPracticeBotId,
  kindLabel,
  levelForXp,
  MIN_PLAYERS,
  xpToNextLevel,
  nextArenaStats,
  pickPassage,
  pickPracticeBotWpm,
  practiceBotFor,
  PRACTICE_DIFFICULTIES,
  RACE_DEADLINE_MS,
  recordFinish,
  SERIES_BEST_OF,
  SERIES_WINS_NEEDED,
  seriesStandings,
  utcDayKey,
} from "./games.rules.js";

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

// ── Solo practice helpers ─────────────────────────────────────────────
// Practice sessions have no conversation (no DM, no chip): access means "are
// you the human player", and delivery goes straight to that player.
function practiceHumanId(session) {
  const human = (session.players || []).find((p) => !p.isBot);
  return human ? human.userId.toString() : null;
}

function assertPracticeAccess(session, userId) {
  const player = (session.players || []).find(
    (p) => p.userId.toString() === String(userId) && !p.isBot,
  );
  if (!player || (player.status !== "joined" && player.status !== "invited")) {
    throw forbidden("You are not part of this practice race", "NOT_INVITED");
  }
  return player;
}

// Same event, right room: conversation rooms for 1v1, the player's own socket
// room for practice (which has no conversation to broadcast to).
function emitGameEvent(session, event, payload) {
  if (session.conversationId) {
    emitToConversation(session.conversationId.toString(), event, payload);
  } else {
    const humanId = practiceHumanId(session);
    if (humanId) emitToUser(humanId, event, payload);
  }
}

// Persist one player's arena progression (XP, streaks, weekly board). Never
// throws — progression must not break the finish flow it observes.
async function applyArenaStats({ userId, won, wpm, practice = false, boardOnly = false }) {
  try {
    if (!userId || isPracticeBotId(userId)) return;
    const weekKey = arenaWeekKey();
    const dayKey = utcDayKey();
    const user = await User.findById(userId).select("arena").lean();
    if (!user) return;
    const next = nextArenaStats(user.arena || {}, { won, wpm, practice, weekKey, dayKey, boardOnly });
    await User.findByIdAndUpdate(userId, { $set: { arena: next } });
  } catch (err) {
    console.error("[games] arena stats failed:", err?.message || err);
  }
}

// Advance the bot to the server clock. Returns true when the bot just won.
// Called on every practice read/write so no timer process is needed: the bot
// only moves when the server looks at it (player ping, poll, finish), and the
// client polls while a practice race runs so an idle player's loss still lands.
function advancePracticeBot(session, nowMs = Date.now()) {
  if (!session.isPractice || session.status !== "active") return false;
  const bot = (session.players || []).find((p) => p.isBot);
  if (!bot || bot.finishedAt) return false;
  if (!session.startedAt || nowMs < new Date(session.startedAt).getTime()) return false;
  const elapsed = nowMs - new Date(session.startedAt).getTime();
  bot.progress = botProgressAt(session.botWpm, session.passage, elapsed);
  const human = (session.players || []).find((p) => !p.isBot);
  if (bot.progress >= 1 && !(human && human.finishedAt)) {
    recordFinish(session, bot, elapsed, 100);
    session.status = "finished";
    session.finishedAt = new Date();
    return true;
  }
  return false;
}

// Client-safe player list. Every emit that carries players uses this shape, so a
// client can safely replace its local copy — a partial shape would silently drop
// `status` and make the UI think the player had left the race.
export function publicPlayers(session) {
  return (session.players || []).map((p) => ({
    userId: p.userId.toString(),
    displayName: p.displayName || null,
    status: p.status,
    isBot: Boolean(p.isBot),
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
// `countdownMs` is the single source of truth for the 3-2-1 window so clients
// never hand-mirror COUNTDOWN_MS (see games.rules.js).
export function publicGame(session, { includePassage = false } = {}) {
  const view = {
    id: session._id.toString(),
    kind: session.kind,
    status: session.status,
    conversationId: session.conversationId ? session.conversationId.toString() : null,
    messageId: session.messageId ? session.messageId.toString() : null,
    isPractice: Boolean(session.isPractice),
    botDifficulty: session.botDifficulty || null,
    createdBy: session.createdBy.toString(),
    players: publicPlayers(session),
    startedAt: session.startedAt ? new Date(session.startedAt).toISOString() : null,
    finishedAt: session.finishedAt ? new Date(session.finishedAt).toISOString() : null,
    expiresAt: session.expiresAt ? new Date(session.expiresAt).toISOString() : null,
    winnerId: session.winnerId ? session.winnerId.toString() : null,
    countdownMs: COUNTDOWN_MS,
    seriesId: session.seriesId ? session.seriesId.toString() : null,
    round: session.round || 1,
    rematchOf: session.rematchOf ? session.rematchOf.toString() : null,
    seriesBestOf: SERIES_BEST_OF,
    seriesWinsNeeded: SERIES_WINS_NEEDED,
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
    seriesId: session.seriesId || null,
    round: session.round || 1,
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
// Practice races have no conversation, so there is no chip to post.
async function postResultChip(session) {
  if (!session.conversationId) return null;
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
  // Typing unlocks when the countdown ends — see COUNTDOWN_MS.
  session.startedAt = new Date(Date.now() + COUNTDOWN_MS);
  session.finishedAt = null;
  session.expiresAt = new Date(Date.now() + COUNTDOWN_MS + RACE_DEADLINE_MS);
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
  // Only sessions I'm still in count — declined/left ones are already dead.
  const { limits } = await getRequesterPlan(User, userId);
  const open = await GameSession.countDocuments({
    status: { $in: ["pending", "active"] },
    players: { $elemMatch: { userId, status: { $in: ["invited", "joined"] } } },
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

// Solo practice vs bot. No DM, no chip, no invite handshake: the race is born
// active (with the usual 3-2-1 countdown) and the response carries the passage
// so the arena can drop straight into the race view. Practice is excluded from
// plan caps, GAME_EXISTS and series — starting a new one retires any live
// practice instead of stacking stale races.
export async function startPractice({ userId, difficulty = "medium" }) {
  if (!PRACTICE_DIFFICULTIES.includes(difficulty)) {
    throw badRequest("Pick a difficulty: easy, medium or hard", "INVALID_DIFFICULTY");
  }
  const bot = practiceBotFor(difficulty);

  const stale = await GameSession.find({
    isPractice: true,
    status: { $in: ["pending", "active"] },
    "players.userId": userId,
  });
  for (const s of stale) {
    s.status = "cancelled";
    s.finishedAt = new Date();
    await s.save();
  }

  const me = await User.findById(userId).select("displayName username").lean();
  if (!me) throw notFound("Player not found", "USER_NOT_FOUND");

  const session = await GameSession.create({
    kind: "typing",
    status: "active",
    conversationId: null,
    createdBy: userId,
    players: [
      {
        userId,
        displayName: me.displayName || me.username || "Player",
        status: "joined",
      },
      {
        userId: bot.userId,
        displayName: bot.name,
        status: "joined",
        isBot: true,
      },
    ],
    passage: pickPassage(),
    startedAt: new Date(Date.now() + COUNTDOWN_MS),
    expiresAt: new Date(Date.now() + COUNTDOWN_MS + RACE_DEADLINE_MS),
    isPractice: true,
    botDifficulty: difficulty,
    botWpm: pickPracticeBotWpm(difficulty),
  });
  return publicGame(session, { includePassage: true });
}

// Accept an invite. A 1v1 race starts the instant both players are in, so
// accepting is the whole handshake — no separate "start" step.
export async function joinGame({ gameId, userId }) {
  const session = await loadSession(gameId);
  if (session.isPractice) {
    assertPracticeAccess(session, userId);
    return publicGame(session, { includePassage: session.status === "active" });
  }
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
  if (session.isPractice) {
    assertPracticeAccess(session, userId);
    return publicGame(session);
  }
  await assertMembership(session.conversationId.toString(), userId);
  if (session.status !== "pending") return publicGame(session);

  const player = session.players.find((p) => p.userId.toString() === String(userId));
  if (!player) throw forbidden("You were not invited to this game", "NOT_INVITED");
  player.status = "declined";
  player.progress = 0;

  // A declined 1v1 can never start — cancel it so the chip stops saying
  // "waiting", the arena frees the pair for a fresh invite (GAME_EXISTS), and
  // the abandonment sweep never has to reap it 30 min later.
  const joined = session.players.filter((p) => p.status === "joined");
  const hasDeclined = session.players.some((p) => p.status === "declined");
  if (hasDeclined && joined.length < MIN_PLAYERS) {
    session.status = "cancelled";
    session.finishedAt = new Date();
    await session.save();
    await syncCard(session);
    emitToConversation(session.conversationId.toString(), "game:cancelled", publicGame(session));
    return publicGame(session);
  }

  await session.save();
  await syncCard(session);
  emitToConversation(session.conversationId.toString(), "game:updated", publicGame(session));
  return publicGame(session);
}

// Manual start — still available to the host if the invitee already accepted but
// the race has not begun (e.g. a re-opened arena).
export async function startGame({ gameId, userId }) {
  const session = await loadSession(gameId);
  if (session.isPractice) {
    assertPracticeAccess(session, userId);
    return publicGame(session, { includePassage: session.status === "active" });
  }
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
  if (session.isPractice) {
    const player = assertPracticeAccess(session, userId);
    if (session.status !== "active") throw badRequest("Race is not active", "GAME_NOT_ACTIVE");
    if (session.startedAt && Date.now() < new Date(session.startedAt).getTime()) {
      return { ok: true };
    }
    // The bot moves on the server clock; a ping that arrives after the bot
    // crossed the line ends the race with the bot's win.
    if (advancePracticeBot(session)) {
      await session.save();
      emitGameEvent(session, "game:finished", publicGame(session));
      return { ok: true };
    }
    const next = Math.max(player.progress || 0, Math.min(1, Number(progress) || 0));
    if (next === (player.progress || 0)) {
      await session.save();
      return { ok: true };
    }
    player.progress = next;
    session.expiresAt = new Date(Date.now() + RACE_DEADLINE_MS);
    await session.save();
    emitGameEvent(session, "game:progress", {
      gameId: session._id.toString(),
      conversationId: session.conversationId ? session.conversationId.toString() : null,
      players: publicPlayers(session),
    });
    return { ok: true };
  }
  await assertMembership(session.conversationId.toString(), userId);
  if (session.status !== "active") throw badRequest("Race is not active", "GAME_NOT_ACTIVE");

  const player = session.players.find(
    (p) => p.userId.toString() === String(userId) && p.status === "joined",
  );
  if (!player) throw forbidden("Join the race first", "NOT_IN_GAME");

  // Progress reported during the 3-2-1 is meaningless (typing is not unlocked
  // yet) — ignore it silently rather than erroring at a fire-and-forget caller.
  if (session.startedAt && Date.now() < new Date(session.startedAt).getTime()) {
    return { ok: true };
  }

  const next = Math.max(player.progress || 0, Math.min(1, Number(progress) || 0));
  if (next === (player.progress || 0)) return { ok: true };

  player.progress = next;
  // Keep an actively-typed race alive: the deadline is a safety net for an
  // abandoned session, not a countdown that can cut a slow typist off mid-race.
  session.expiresAt = new Date(Date.now() + RACE_DEADLINE_MS);
  await session.save();
  emitGameEvent(session, "game:progress", {
    gameId: session._id.toString(),
    conversationId: session.conversationId.toString(),
    // Full player shape — clients replace their copy wholesale.
    players: publicPlayers(session),
  });
  return { ok: true };
}

export async function finishGame({ gameId, userId, accuracy, elapsedMs }) {
  const session = await loadSession(gameId);
  if (session.isPractice) {
    assertPracticeAccess(session, userId);
  } else {
    await assertMembership(session.conversationId.toString(), userId);
  }

  const player = session.isPractice
    ? session.players.find((p) => p.userId.toString() === String(userId) && !p.isBot)
    : session.players.find(
        (p) => p.userId.toString() === String(userId) && p.status === "joined",
      );
  if (!player) throw forbidden("Join the race first", "NOT_IN_GAME");
  // Idempotent — a retry must not claim two places.
  if (player.finishedAt) return publicGame(session);

  const startedAtMs = session.startedAt ? new Date(session.startedAt).getTime() : Date.now();
  // Nothing may finish during the 3-2-1: the clock has not started yet.
  if (Date.now() < startedAtMs) {
    throw badRequest("The race has not started yet", "GAME_NOT_STARTED");
  }

  const serverElapsed = Math.max(0, Date.now() - startedAtMs);
  // Clamp the client's elapsed to what the server observed.
  const claimed = Number(elapsedMs);
  const elapsed = Number.isFinite(claimed) && claimed > 0
    ? Math.min(claimed, serverElapsed)
    : serverElapsed;

  // Practice: settle the bot first — it may have crossed while this request
  // was in flight, in which case this finish lands as the runner-up's.
  if (session.isPractice) {
    advancePracticeBot(session);
  }

  // The race already concluded (the opponent crossed the line first). A finish
  // that was already in flight is recorded so the result can report the margin;
  // anything else just returns the authoritative result instead of erroring.
  if (session.status !== "active") {
    if (!canRecordRunnerUpFinish(session)) return publicGame(session);
    recordFinish(session, player, elapsed, accuracy);
    // Counted at decision time already — fold the late WPM into the board only.
    const boardOnly = player.statsCounted === true;
    player.statsCounted = true;
    await session.save();
    await applyArenaStats({
      userId: player.userId.toString(),
      won: false,
      wpm: player.wpm,
      practice: session.isPractice,
      boardOnly,
    });
    // `game:updated`, never `game:finished` — the race is over, and a second
    // finish event would replay the winner/loser flash on both screens.
    emitGameEvent(session, "game:updated", publicGame(session));
    return publicGame(session);
  }

  recordFinish(session, player, elapsed, accuracy);

  // Crossing the line finishes the race. In a 1v1 there is nothing left to wait
  // for, so the winner is decided and the result is shared right away instead of
  // leaving the finisher on a "waiting for your opponent" screen.
  session.status = "finished";
  session.finishedAt = new Date();
  player.statsCounted = true;
  const loserEntry = (session.players || []).find(
    (p) => !p.isBot && p.userId.toString() !== player.userId.toString(),
  );
  if (loserEntry) loserEntry.statsCounted = true;

  await session.save();
  await applyArenaStats({
    userId: player.userId.toString(),
    won: true,
    wpm: player.wpm,
    practice: session.isPractice,
  });
  if (loserEntry) {
    await applyArenaStats({
      userId: loserEntry.userId.toString(),
      won: false,
      wpm: loserEntry.wpm ?? null,
      practice: false,
    });
  }
  await syncCard(session);
  await postResultChip(session);
  emitGameEvent(session, "game:finished", publicGame(session));
  return publicGame(session);
}

export async function cancelGame({ gameId, userId }) {
  const session = await loadSession(gameId);
  if (session.isPractice) {
    assertPracticeAccess(session, userId);
  } else {
    await assertMembership(session.conversationId.toString(), userId);
  }
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
  emitGameEvent(session, "game:cancelled", publicGame(session));
  return publicGame(session);
}

export async function getGame({ gameId, userId }) {
  const session = await loadSession(gameId);
  if (session.isPractice) {
    assertPracticeAccess(session, userId);
    // Settle the bot on read so an idle player's loss lands on the next poll.
    if (advancePracticeBot(session)) {
      await session.save();
      emitGameEvent(session, "game:finished", publicGame(session));
    }
    return publicGame(session, { includePassage: session.status === "active" });
  }
  await assertMembership(session.conversationId.toString(), userId);
  // Reveal the passage only while a race is actually running.
  return publicGame(session, { includePassage: session.status === "active" });
}

// All games of a best-of series in round order (root first). Accepts either the
// root game id or any game carrying the seriesId.
async function loadSeriesGames(seriesKey) {
  if (!mongoose.Types.ObjectId.isValid(seriesKey)) {
    throw badRequest("Invalid series id", "INVALID_ID");
  }
  const games = await GameSession.find({
    $or: [{ _id: seriesKey }, { seriesId: seriesKey }],
  }).sort({ round: 1, createdAt: 1 });
  if (games.length === 0) throw notFound("Series not found", "SERIES_NOT_FOUND");
  return games;
}

// Arena: best-of-3 series summary for a finished race's result screen.
// Returns { seriesId, games, wins, finishedCount, winnerId, isComplete,
// round, bestOf, winsNeeded } — wins keyed by userId string.
export async function getSeries({ seriesId, userId }) {
  const games = await loadSeriesGames(seriesId);
  const first = games[0];
  await assertMembership(first.conversationId.toString(), userId);
  const standings = seriesStandings(
    games.map((g) => ({
      status: g.status,
      winnerId: g.winnerId ? g.winnerId.toString() : null,
    })),
  );
  const key = first.seriesId ? first.seriesId.toString() : first._id.toString();
  return {
    seriesId: key,
    games: games.map((g) => publicGame(g)),
    wins: standings.wins,
    finishedCount: standings.finishedCount,
    winnerId: standings.winnerId,
    isComplete: standings.isComplete,
    bestOf: SERIES_BEST_OF,
    winsNeeded: SERIES_WINS_NEEDED,
  };
}

// Rematch: one tap from a finished race's result screen. Creates Game N+1 in
// the SAME conversation (same DM thread + same chip timeline), carrying the
// series forward. Only participants of a finished/cancelled game may rematch,
// only while the series is undecided, and only when no game is live in that
// conversation (otherwise GAME_EXISTS — the client should open that game).
export async function rematchGame({ gameId, userId }) {
  const previous = await loadSession(gameId);
  await assertMembership(previous.conversationId.toString(), userId);
  if (previous.status !== "finished" && previous.status !== "cancelled") {
    throw badRequest("Finish this race before a rematch", "GAME_NOT_FINISHED");
  }

  const me = previous.players.find((p) => p.userId.toString() === String(userId));
  if (!me || (me.status !== "joined" && me.status !== "invited")) {
    throw forbidden("You were not part of this game", "NOT_INVITED");
  }
  const opponentEntry = previous.players.find((p) => p.userId.toString() !== String(userId));
  if (!opponentEntry) throw badRequest("No opponent to rematch", "NO_OPPONENT");

  const seriesKey = previous.seriesId
    ? previous.seriesId.toString()
    : previous._id.toString();
  const seriesGames = await GameSession.find({
    $or: [{ _id: seriesKey }, { seriesId: seriesKey }],
  });
  const standings = seriesStandings(
    seriesGames.map((g) => ({
      status: g.status,
      winnerId: g.winnerId ? g.winnerId.toString() : null,
    })),
  );
  if (standings.isComplete) {
    throw conflict("This series is already decided", "SERIES_COMPLETE");
  }

  const conversation = await Conversation.findById(previous.conversationId);
  if (!conversation) throw notFound("Conversation not found", "CONVERSATION_NOT_FOUND");
  await assertDmNotBlocked(conversation, userId);

  const existing = await GameSession.findOne({
    conversationId: conversation._id,
    status: { $in: ["pending", "active"] },
  });
  if (existing) {
    throw conflict("There's already a game going with this player", "GAME_EXISTS");
  }

  const { limits } = await getRequesterPlan(User, userId);
  const open = await GameSession.countDocuments({
    status: { $in: ["pending", "active"] },
    players: { $elemMatch: { userId, status: { $in: ["invited", "joined"] } } },
  });
  if (open >= limits.gamesPerConversationActive) {
    throw forbidden(
      `You already have ${limits.gamesPerConversationActive} game${limits.gamesPerConversationActive === 1 ? "" : "s"} going — finish one first`,
      "GAME_LIMIT",
    );
  }

  const [meUser, opponentUser] = await Promise.all([
    User.findById(userId).select("displayName username").lean(),
    User.findById(opponentEntry.userId).select("displayName username").lean(),
  ]);

  const nextRound = seriesGames.length + 1;
  const session = await GameSession.create({
    kind: previous.kind,
    status: "pending",
    conversationId: conversation._id,
    createdBy: userId,
    players: [
      {
        userId,
        displayName:
          meUser?.displayName || meUser?.username || me?.displayName || "Player",
        status: "joined",
      },
      {
        userId: opponentEntry.userId,
        displayName:
          opponentUser?.displayName ||
          opponentUser?.username ||
          opponentEntry.displayName ||
          "Player",
        status: "invited",
      },
    ],
    seriesId: seriesKey,
    round: nextRound,
    rematchOf: previous._id,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });

  const message = await Message.create({
    conversationId: conversation._id,
    senderId: userId,
    content: `${kindLabel(session.kind)} rematch · Game ${nextRound} of ${SERIES_BEST_OF}`,
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
  emitToUser(opponentEntry.userId.toString(), "game:invited", publicGame(session));
  notificationsService
    .createForMessage({ message, conversation, inThread: false })
    .catch((err) => console.error("[games] rematch notification failed:", err?.message || err));

  return publicGame(session);
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
// Excludes sessions I already declined/left so a dead invite never blocks the
// arena list or the per-pair GAME_EXISTS guard from the client's perspective.
export async function listMyGames({ userId }) {
  const sessions = await GameSession.find({
    status: { $in: ["pending", "active"] },
    players: { $elemMatch: { userId, status: { $in: ["invited", "joined"] } } },
  })
    .sort({ createdAt: -1 })
    .limit(20);
  return sessions.map((s) => publicGame(s));
}

// Weekly WPM board + my progression snapshot for the arena header/sidebar.
// Ranked 1v1 finishes only (practice never touches the board). Ranked by
// weekly best WPM; my rank counts strictly-faster boards ahead of mine.
export async function getLeaderboard({ userId, limit = ARENA_LEADERBOARD_SIZE }) {
  const weekKey = arenaWeekKey();
  const size = Math.min(50, Math.max(5, Number(limit) || ARENA_LEADERBOARD_SIZE));
  const rows = await User.find({
    "arena.weekKey": weekKey,
    "arena.weekGames": { $gt: 0 },
  })
    .select("displayName username avatarUrl arena")
    .sort({ "arena.weekBestWpm": -1, "arena.weekTotalWpm": -1 })
    .limit(size)
    .lean();

  const entries = rows.map((u, i) => ({
    rank: i + 1,
    userId: u._id.toString(),
    displayName: u.displayName || u.username || "Player",
    username: u.username || null,
    avatarUrl: u.avatarUrl || null,
    bestWpm: u.arena?.weekBestWpm ?? null,
    avgWpm:
      u.arena?.weekGames > 0 ? Math.round(u.arena.weekTotalWpm / u.arena.weekGames) : null,
    games: u.arena?.weekGames || 0,
    wins: u.arena?.weekWins || 0,
    isMe: u._id.toString() === String(userId),
  }));

  const meDoc = await User.findById(userId).select("arena").lean();
  const meArena = meDoc?.arena || {};
  const inWeek = meArena.weekKey === weekKey;
  let myRank = null;
  if (inWeek && (meArena.weekGames || 0) > 0 && meArena.weekBestWpm != null) {
    const ahead = await User.countDocuments({
      "arena.weekKey": weekKey,
      "arena.weekBestWpm": { $gt: meArena.weekBestWpm },
    });
    myRank = ahead + 1;
  }
  const xp = Math.max(0, Math.floor(Number(meArena.xp) || 0));
  return {
    weekKey,
    endsAt: arenaWeekEndsAt(),
    entries,
    me: {
      rank: myRank,
      xp,
      level: levelForXp(xp),
      xpToNext: xpToNextLevel(xp),
      wins: meArena.wins || 0,
      losses: meArena.losses || 0,
      bestWpm: meArena.bestWpm ?? null,
      currentStreak: meArena.currentStreak || 0,
      bestStreak: meArena.bestStreak || 0,
      dailyStreak: meArena.dailyStreak || 0,
      bestDailyStreak: meArena.bestDailyStreak || 0,
      weekGames: inWeek ? meArena.weekGames || 0 : 0,
      weekBestWpm: inWeek ? (meArena.weekBestWpm ?? null) : null,
    },
  };
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
    emitGameEvent(session, "game:cancelled", publicGame(session));
  }
  return stale.length;
}
