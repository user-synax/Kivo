// Kivo Games — shared client helpers.
//
// The server is authoritative for game state; these helpers only derive display
// values from the public payloads the API and socket events already send.
// Everything is null-safe because a card can render from a partial snapshot.

// Fallback for the 3-2-1 window. The server is the source of truth and sends
// `countdownMs` on every session payload (see games.rules.js COUNTDOWN_MS) —
// use getCountdownMs(game) so a future rule change never desyncs clients.
export const RACE_COUNTDOWN_MS = 3000;

export function getCountdownMs(game) {
  const v = Number(game?.countdownMs);
  return Number.isFinite(v) && v > 0 && v <= 10000 ? v : RACE_COUNTDOWN_MS;
}

// A player is "nearly done" from here on — the point where a race gets tense.
export const RACE_DANGER_PCT = 80;

// No emojis here — game icons are lucide components at the call site
// (Keyboard for typing, Gamepad2 fallback). Keep this metadata text-only.
export const GAME_KINDS = Object.freeze({
  typing: {
    label: "Typing Race",
    blurb: "Type the passage fastest",
  },
});

export function gameKindMeta(kind) {
  return GAME_KINDS[kind] || { label: "Game", blurb: "" };
}

export function gameKindLabel(kind) {
  return gameKindMeta(kind).label;
}

export function gameIsPending(game) {
  return game?.status === "pending";
}
export function gameIsActive(game) {
  return game?.status === "active";
}
export function gameIsFinished(game) {
  return game?.status === "finished";
}
export function gameIsCancelled(game) {
  return game?.status === "cancelled";
}

export function joinedPlayers(game) {
  return (game?.players || []).filter((p) => p.status === "joined");
}

export function playerFor(game, userId) {
  if (!game || !userId) return null;
  return (game?.players || []).find((p) => p.userId === userId) || null;
}

export function isInGame(game, userId) {
  const player = playerFor(game, userId);
  return Boolean(player) && player.status === "joined";
}

export function isHost(game, userId) {
  return Boolean(game && userId) && game.createdBy === userId;
}

export function progressPercent(player) {
  const p = Number(player?.progress) || 0;
  return Math.round(Math.max(0, Math.min(1, p)) * 100);
}

// Finishers in podium order (1st, 2nd, …). Unfinished players are excluded.
export function gameResults(game) {
  return joinedPlayers(game)
    .filter((p) => p.place != null)
    .sort((a, b) => (a.place || 99) - (b.place || 99));
}

export function formatWpm(wpm) {
  return Number.isFinite(wpm) ? `${Math.round(wpm)} wpm` : "—";
}

export function formatAccuracy(accuracy) {
  if (!Number.isFinite(accuracy)) return "—";
  return `${Math.round(accuracy * 10) / 10}%`;
}

// Gap between the winner's and the runner-up's finish times — only available on a
// genuine photo finish, where both players completed the passage near-simultaneously
// so the server recorded both. Null when the runner-up never crossed the line.
export function raceMarginMs(game) {
  const results = gameResults(game);
  if (results.length < 2) return null;
  const [first, second] = results;
  if (
    !Number.isFinite(first?.elapsedMs) ||
    !Number.isFinite(second?.elapsedMs)
  ) {
    return null;
  }
  return Math.max(0, second.elapsedMs - first.elapsedMs);
}

// How close was it? The race ends the instant someone finishes, so the runner-up
// usually has no finish time at all — their progress at that moment is the only
// real evidence. Returns the furthest-along player who never crossed the line.
export function runnerUpProgress(game) {
  const finished = new Set(gameResults(game).map((p) => p.userId));
  const runnerUp = joinedPlayers(game)
    .filter((p) => !finished.has(p.userId))
    .sort((a, b) => (Number(b.progress) || 0) - (Number(a.progress) || 0))[0];
  if (!runnerUp) return null;
  return {
    player: runnerUp,
    progress: Math.max(0, Math.min(1, Number(runnerUp.progress) || 0)),
  };
}

// Sub-second gaps read far better as "0.4s" than as "0.0s", so anything under ten
// seconds is expressed in seconds with a redundant trailing zero trimmed.
export function formatGap(ms) {
  if (!Number.isFinite(ms) || ms < 0) return null;
  if (ms >= 10000) return formatMs(ms);
  return `${(ms / 1000).toFixed(2).replace(/0$/, "")}s`;
}

export function formatMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  return `${mins}m ${Math.round(seconds % 60)}s`;
}

// Compact elapsed timer for the live race header (0:07 / 1:42).
export function formatClock(ms) {
  const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function gameStatusText(game) {
  switch (game?.status) {
    case "pending":
      return "Waiting for players";
    case "active":
      return "Race in progress";
    case "finished":
      return "Race finished";
    case "cancelled":
      return "Race cancelled";
    default:
      return "Game";
  }
}

// Two-letter avatar fallback from a display name.
export function initialsFor(name) {
  const clean = String(name || "").trim();
  if (!clean) return "?";
  const parts = clean.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}
