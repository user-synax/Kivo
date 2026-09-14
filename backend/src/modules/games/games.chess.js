import { Chess } from "chess.js";

// Kivo Games — pure chess rules.
//
// Render-free-tier discipline: ZERO timers, ZERO intervals, ZERO background
// work. Clocks are validated lazily — remaining time is derived from stored
// anchors (side to move + lastMoveAt) on every read/write, and a flag is only
// settled when someone looks at the game (move, poll, open). A game nobody
// opens costs exactly nothing between moves: one FEN string + a SAN list.
//
// chess.js does the rules heavy lifting (legal generation, mate/stalemate,
// repetitions, material). Everything here is pure and unit-testable.

export const CHESS_TIME_MS = 10 * 60 * 1000; // 10 minutes each, no increment
export const CHESS_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000; // abandoned games reaped after 7 days
export const CHESS_PROMOTIONS = ["n", "b", "r", "q"];

export function chessStart() {
  const game = new Chess();
  return { fen: game.fen(), moves: [] };
}

function load(fen) {
  try {
    return new Chess(fen);
  } catch {
    const err = new Error("Corrupt board state");
    err.statusCode = 500;
    err.code = "CHESS_STATE";
    throw err;
  }
}

function invalidMove(message = "Illegal move") {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = "ILLEGAL_MOVE";
  return err;
}

// Legal destinations for one square, for client tap-target dots.
// Returns [{ from, to, promotion, san, captured }] — empty when the square
// holds no piece of the side to move.
export function chessLegalMoves(fen, square) {
  if (!/^[a-h][1-8]$/.test(String(square || ""))) {
    throw invalidMove("Pick a square like e2");
  }
  const game = load(fen);
  try {
    return game.moves({ square, verbose: true }).map((m) => ({
      from: m.from,
      to: m.to,
      promotion: m.promotion || null,
      san: m.san,
      captured: m.captured || null,
    }));
  } catch {
    throw invalidMove("Pick a square like e2");
  }
}

// Apply one move. Throws ILLEGAL_MOVE (400) for anything chess.js rejects —
// wrong side, blocked path, self-check exposure, malformed squares.
// Returns { fen, san, promotion }.
export function chessApplyMove(fen, { from, to, promotion } = {}) {
  if (!/^[a-h][1-8]$/.test(String(from || "")) || !/^[a-h][1-8]$/.test(String(to || ""))) {
    throw invalidMove("Moves look like e2 to e4");
  }
  if (promotion != null && !CHESS_PROMOTIONS.includes(promotion)) {
    throw invalidMove("Promotion must be a knight, bishop, rook or queen");
  }
  const game = load(fen);
  let applied;
  try {
    applied = game.move({ from, to, promotion: promotion || undefined });
  } catch {
    throw invalidMove();
  }
  return { fen: game.fen(), san: applied.san, promotion: applied.promotion || null };
}

// Side to move: "w" or "b".
export function chessTurn(fen) {
  return load(fen).turn();
}

// Terminal state of a position. winner is "w"/"b"/null (null = draw).
export function chessGameStatus(fen) {
  const game = load(fen);
  if (game.isCheckmate()) {
    return { over: true, winner: game.turn() === "w" ? "b" : "w", reason: "checkmate" };
  }
  if (game.isStalemate()) return { over: true, winner: null, reason: "stalemate" };
  if (game.isInsufficientMaterial()) return { over: true, winner: null, reason: "material" };
  if (game.isThreefoldRepetition()) return { over: true, winner: null, reason: "repetition" };
  if (game.isDraw()) return { over: true, winner: null, reason: "fifty" };
  return { over: false, winner: null, reason: null };
}

// Square of the side-to-move king when it is in check (for client highlight).
export function chessCheckSquare(fen) {
  const game = load(fen);
  if (!game.inCheck()) return null;
  const color = game.turn();
  const board = game.board();
  for (const row of board) {
    for (const cell of row) {
      if (cell && cell.type === "k" && cell.color === color) return cell.square;
    }
  }
  return null;
}

// Lazy clock: ms remaining for `color` given stored anchors. Never negative,
// never ticking server-side — the client animates from these anchors and the
// server re-derives on every move/read.
export function chessRemainingMs({ whiteMs, blackMs, turn, lastMoveAt }, color, nowMs = Date.now()) {
  const stored = color === "w" ? whiteMs : blackMs;
  let remaining = Number(stored);
  if (!Number.isFinite(remaining)) remaining = CHESS_TIME_MS;
  if (turn === color && lastMoveAt) {
    remaining -= Math.max(0, nowMs - new Date(lastMoveAt).getTime());
  }
  return Math.max(0, Math.round(remaining));
}

// Flag detection on read/move: when the side to move has no time left, the
// other side wins. Returns "w"/"b" (the WINNER) or null.
export function chessFlagWinner({ whiteMs, blackMs, turn, lastMoveAt }, nowMs = Date.now()) {
  if (!lastMoveAt) return null;
  const remaining = chessRemainingMs({ whiteMs, blackMs, turn, lastMoveAt }, turn, nowMs);
  if (remaining > 0) return null;
  return turn === "w" ? "b" : "w";
}

export function chessReasonLabel(reason) {
  switch (reason) {
    case "checkmate":
      return "Checkmate";
    case "stalemate":
      return "Stalemate";
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
