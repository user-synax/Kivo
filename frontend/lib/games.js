// Kivo Games — shared client helpers.
//
// The server is authoritative for game state; these helpers only derive display
// values from the public payloads the API and socket events already send.
// Everything is null-safe because a card can render from a partial snapshot.

export const GAME_KINDS = Object.freeze({
  typing: {
    label: "Typing Race",
    emoji: "⌨️",
    blurb: "Type the passage fastest",
  },
});

export function gameKindMeta(kind) {
  return GAME_KINDS[kind] || { label: "Game", emoji: "🎮", blurb: "" };
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
