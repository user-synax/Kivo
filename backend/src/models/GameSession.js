import mongoose from "mongoose";

// Kivo Games — one document per game session.
//
// Unlike polls (which live inside a Message), a game session gets its own
// collection because it carries live per-player progress, a server-picked
// passage, and room to grow into games with real rule state (chess, ludo). The
// chat timeline holds a thin `game` card message that points at the session
// (see Message.game) so the invite + result live in the conversation.
//
// MongoDB stays authoritative: every turn/progress/finish write lands here and
// only then is announced over Socket.IO.
export const GAME_KINDS = ["typing"];

// Session statuses:
//   pending   → invite posted, waiting for players / the creator to start
//   active    → race is running
//   finished  → every joined player finished
//   cancelled → creator cancelled, or the session expired
export const GAME_STATUSES = ["pending", "active", "finished", "cancelled"];

const gamePlayerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // Denormalized at join time so the timeline card renders names without a
    // cross-collection join (same tradeoff as Message.forwardedFromName).
    displayName: { type: String, default: null },
    // Lifecycle: "invited" until they accept from the arena; "joined" once in;
    // "declined" if they turn it down; "left" if they bail mid-session.
    status: { type: String, enum: ["invited", "joined", "declined", "left"], default: "joined" },
    // True for solo-practice bot players (fixed bot ObjectIds, never real users).
    isBot: { type: Boolean, default: false },
    // Whether this player's result already fed arena progression (XP/streaks).
    // Set at decision time for both sides so a late runner-up finish can only
    // fold its WPM into the board, never double-count the loss.
    statsCounted: { type: Boolean, default: false },
    // Live progress for the current round, 0..1 (typing: fraction of the
    // passage completed). Kept on the session, never written per keystroke.
    progress: { type: Number, default: 0, min: 0, max: 1 },
    // Finish stats. `place` is 1 for the winner; null until they finish.
    place: { type: Number, default: null },
    wpm: { type: Number, default: null },
    accuracy: { type: Number, default: null },
    elapsedMs: { type: Number, default: null },
    finishedAt: { type: Date, default: null },
  },
  { _id: false }
);

const gameSessionSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: GAME_KINDS, required: true, default: "typing" },
    status: { type: String, enum: GAME_STATUSES, default: "pending" },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      // Null for solo-practice sessions: no DM thread, no chat chip — the race
      // lives only in the arena. All practice emits go to the player directly.
      default: null,
      index: true,
    },
    // The timeline card message representing this session in chat.
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    // The separate result card posted when the race concludes (guards against
    // posting it twice if finish is retried).
    resultMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    players: { type: [gamePlayerSchema], default: [] },
    // Typing-race payload. The passage is chosen server-side at start so a
    // client cannot pick its own (or see it before the race begins).
    passage: { type: String, default: null },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    // Abandonment guard: pending invites expire, active races end at the deadline.
    expiresAt: { type: Date, default: null },
    winnerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // Solo practice vs bot. Human + one fixed bot player, active immediately,
    // no conversation or chip. Excluded from series, plan caps and GAME_EXISTS.
    isPractice: { type: Boolean, default: false, index: true },
    botDifficulty: { type: String, enum: ["easy", "medium", "hard"], default: null },
    botWpm: { type: Number, default: null },
    // Rematch series (best-of-3). The first game of a series has seriesId null;
    // a rematch sets seriesId to the root game's id (or the existing seriesId)
    // and round to series length + 1. rematchOf points at the game rematched
    // from, so the arena can render "Game 2 of 3" chains.
    seriesId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GameSession",
      default: null,
      index: true,
    },
    round: { type: Number, default: 1, min: 1 },
    rematchOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GameSession",
      default: null,
    },
  },
  { timestamps: true }
);

// Conversation-scoped listing (chat header + active-game guard).
gameSessionSchema.index({ conversationId: 1, status: 1, createdAt: -1 });
// "My active games" lookup + the abandonment sweep.
gameSessionSchema.index({ status: 1, expiresAt: 1 });
gameSessionSchema.index({ "players.userId": 1, status: 1, updatedAt: -1 });
// Rematch series lookup (all games of a best-of-3 in round order).
gameSessionSchema.index({ seriesId: 1, round: 1 });

export const GameSession = mongoose.model("GameSession", gameSessionSchema);
export default GameSession;
