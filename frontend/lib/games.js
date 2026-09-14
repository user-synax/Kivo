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
// (Keyboard for typing, Crown for chess, Gamepad2 fallback). Text-only.
export const GAME_KINDS = Object.freeze({
  typing: {
    label: "Typing Race",
    blurb: "Type the passage fastest",
  },
  chess: {
    label: "Chess",
    blurb: "Outplay them move by move",
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

// ── Chess (client board helpers) ──────────────────────────────────────
// FEN parsing + text piece glyphs for the tap board. Glyphs are Unicode text
// shapes (not emojis) rendered in currentColor — no assets, theme-aware.

export function isChessGame(game) {
  return game?.kind === "chess";
}

const CHESS_GLYPHS = Object.freeze({
  wk: "♚",
  wq: "♛",
  wr: "♜",
  wb: "♝",
  wn: "♞",
  wp: "♟",
  bk: "♚",
  bq: "♛",
  br: "♜",
  bb: "♝",
  bn: "♞",
  bp: "♟",
});

export function chessGlyph(color, type) {
  return CHESS_GLYPHS[`${color}${type}`] || "";
}

// 64 squares from a FEN placement field, rank 8 first:
// [{ square: "a8", color: "w"|"b"|null, type: "p"|...|null }]
export function fenToBoard(fen) {
  const placement = String(fen || "").split(" ")[0] || "";
  const rows = placement.split("/");
  const out = [];
  const files = "abcdefgh";
  for (let r = 0; r < 8; r += 1) {
    const rank = 8 - r;
    let file = 0;
    for (const ch of rows[r] || "") {
      if (/\d/.test(ch)) {
        for (let i = 0; i < Number(ch); i += 1) {
          out.push({
            square: `${files[file]}${rank}`,
            color: null,
            type: null,
          });
          file += 1;
        }
      } else {
        out.push({
          square: `${files[file]}${rank}`,
          color: ch === ch.toUpperCase() ? "w" : "b",
          type: ch.toLowerCase(),
        });
        file += 1;
      }
    }
    while (file < 8) {
      out.push({ square: `${files[file]}${rank}`, color: null, type: null });
      file += 1;
    }
  }
  return out.slice(0, 64);
}

export function myChessColor(game, viewerId) {
  if (!game?.chess || !viewerId) return null;
  if (String(game.chess.whiteUserId) === String(viewerId)) return "w";
  if (String(game.chess.blackUserId) === String(viewerId)) return "b";
  return null;
}

export function isMyChessTurn(game, viewerId) {
  if (!game?.chess || game?.status !== "active") return false;
  return String(game.chess.turnUserId) === String(viewerId);
}

// Mirror of the server's chessReasonLabel — result + flash subtitles for chess.
export function chessEndReasonLabel(reason) {
  switch (reason) {
    case "checkmate":
      return "Checkmate";
    case "stalemate":
      return "Stalemate · draw";
    case "material":
      return "Draw · bare kings";
    case "repetition":
      return "Draw · repetition";
    case "fifty":
      return "Draw · fifty moves";
    case "resign":
      return "Resignation";
    case "flag":
      return "Won on time";
    default:
      return "Finished";
  }
}

// Remaining clock for a color at `nowMs`, from the server's lazy anchors:
// the serialized values are exact at asOf; only the side to move burns after.
export function chessClockAt(chess, color, nowMs = Date.now()) {
  if (!chess) return 0;
  const base = Number(color === "w" ? chess.whiteMs : chess.blackMs);
  const safe = Number.isFinite(base) ? base : 10 * 60 * 1000;
  const asOf = Number(new Date(chess.asOf || Date.now()).getTime());
  const burn = chess.turn === color ? Math.max(0, nowMs - asOf) : 0;
  return Math.max(0, Math.round(safe - burn));
}

export function formatChessClock(ms) {
  const total = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

// ── Arena entry transition ────────────────────────────────────────────
// One-shot flag so /games can show the "Welcome to the Game Arena" gate only
// when the user arrived via the icon rail / menu — direct visits and reloads
// skip it. sessionStorage keeps it per-tab and auto-scopes it to one entry.
const ARENA_ENTRY_KEY = "kivo:arena:enter";

export function markArenaEntry() {
  try {
    sessionStorage.setItem(ARENA_ENTRY_KEY, "1");
  } catch {}
}

export function consumeArenaEntry() {
  try {
    if (sessionStorage.getItem(ARENA_ENTRY_KEY) === "1") {
      sessionStorage.removeItem(ARENA_ENTRY_KEY);
      return true;
    }
  } catch {}
  return false;
}

// ── Solo practice vs bot ──────────────────────────────────────────────
// Mirrors PRACTICE_BOTS in backend/src/modules/games/games.rules.js (names +
// base paces duplicated for display; the server owns the actual race pace).

export const PRACTICE_DIFFICULTIES = Object.freeze([
  {
    id: "easy",
    label: "Easy",
    botName: "Rookie Bot",
    wpm: 30,
    blurb: "Warm up",
  },
  {
    id: "medium",
    label: "Medium",
    botName: "Dash Bot",
    wpm: 55,
    blurb: "Steady race",
  },
  {
    id: "hard",
    label: "Hard",
    botName: "Blaze Bot",
    wpm: 80,
    blurb: "Blistering",
  },
]);

export function practiceDifficultyFor(id) {
  return (
    PRACTICE_DIFFICULTIES.find((d) => d.id === id) || PRACTICE_DIFFICULTIES[1]
  );
}

export function isPracticeGame(game) {
  return Boolean(game?.isPractice);
}

export function isBotPlayer(player) {
  if (!player) return false;
  if (player.isBot) return true;
  return String(player.userId || "").startsWith("bot-");
}

// ── Rematch series (best-of-3) ──────────────────────────────────────────
// Server owns standings; these derive display values from the series payload
// GET /api/v1/games/series/:seriesId returns:
// { seriesId, games, wins, finishedCount, winnerId, isComplete, bestOf,
//   winsNeeded } with wins keyed by userId string.

export function seriesKeyFor(game) {
  if (!game) return null;
  return game.seriesId || game.id || null;
}

export function gameRound(game) {
  const r = Number(game?.round);
  return Number.isFinite(r) && r >= 1 ? Math.floor(r) : 1;
}

export function seriesWinsFor(series, userId) {
  if (!series || !userId) return 0;
  return Number(series?.wins?.[String(userId)] || 0);
}

// "Series 1–0 · First to 2" / "Series tied 1–1 · Decider" / "You took the series 2–1"
export function seriesScoreText(series, viewerId, opponentId) {
  if (!series) return null;
  const mine = seriesWinsFor(series, viewerId);
  const theirs = opponentId ? seriesWinsFor(series, opponentId) : 0;
  const needed = Number(series.winsNeeded) || 2;
  if (series.winnerId) {
    const iWon = String(series.winnerId) === String(viewerId);
    return iWon
      ? `You took the series ${Math.max(mine, theirs)}–${Math.min(mine, theirs)}`
      : `They took the series ${Math.max(mine, theirs)}–${Math.min(mine, theirs)}`;
  }
  if (mine === theirs) return `Series tied ${mine}–${theirs} · Decider next`;
  return `Series ${mine}–${theirs} · First to ${needed}`;
}

// Weekly board reset countdown: "Ends in 2d 4h" / "Ends in 3h 12m" / "Ends in
// 9m". Computed from the server's endsAt; refreshed on every board fetch.
export function formatBoardReset(endsAt, nowMs = Date.now()) {
  const ms = Number(endsAt) - Number(nowMs);
  if (!Number.isFinite(ms) || ms <= 0) return "Resetting…";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `Ends in ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Ends in ${hours}h ${mins % 60}m`;
  return `Ends in ${Math.floor(hours / 24)}d ${hours % 24}h`;
}

// Two-letter avatar fallback from a display name.
export function initialsFor(name) {
  const clean = String(name || "").trim();
  if (!clean) return "?";
  const parts = clean.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}
