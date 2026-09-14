import { describe, expect, test } from "bun:test";
import {
  CHESS_TIME_MS,
  chessApplyMove,
  chessCheckSquare,
  chessFlagWinner,
  chessGameStatus,
  chessLegalMoves,
  chessReasonLabel,
  chessRemainingMs,
  chessStart,
} from "./games.chess.js";

// Kivo Games — chess rule tests. Pure + dependency-light (chess.js only, no
// Mongoose), same bun:test pattern as games.test.js.

const START = chessStart().fen;

describe("chessStart", () => {
  test("deals the standard opening", () => {
    expect(START.startsWith("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR")).toBe(true);
  });
});

describe("chessApplyMove", () => {
  test("accepts a legal move and advances the position", () => {
    const after = chessApplyMove(START, { from: "e2", to: "e4" });
    expect(after.san).toBe("e4");
    expect(after.fen).not.toBe(START);
  });

  test("rejects moving the wrong side", () => {
    const after = chessApplyMove(START, { from: "e2", to: "e4" });
    expect(() => chessApplyMove(after.fen, { from: "d2", to: "d4" })).toThrow();
  });

  test("rejects illegal destinations and malformed squares", () => {
    expect(() => chessApplyMove(START, { from: "e2", to: "e5" })).toThrow();
    expect(() => chessApplyMove(START, { from: "e9", to: "e4" })).toThrow();
    expect(() => chessApplyMove(START, { from: "e2", to: "e4", promotion: "k" })).toThrow();
  });

  test("rejects corrupt positions without crashing", () => {
    expect(() => chessApplyMove("nope", { from: "e2", to: "e4" })).toThrow();
  });
});

describe("chessLegalMoves", () => {
  test("lists pawn options from the start", () => {
    const moves = chessLegalMoves(START, "e2");
    expect(moves.map((m) => m.to).sort()).toEqual(["e3", "e4"]);
  });

  test("is empty for empty squares and rejects junk", () => {
    expect(chessLegalMoves(START, "e4")).toEqual([]);
    expect(() => chessLegalMoves(START, "z9")).toThrow();
  });
});

describe("chessGameStatus", () => {
  test("opening is not terminal", () => {
    expect(chessGameStatus(START)).toEqual({ over: false, winner: null, reason: null });
  });

  test("detects fool's mate", () => {
    let fen = START;
    for (const [from, to] of [
      ["f2", "f3"],
      ["e7", "e5"],
      ["g2", "g4"],
      ["d8", "h4"],
    ]) {
      fen = chessApplyMove(fen, { from, to }).fen;
    }
    expect(chessGameStatus(fen)).toEqual({ over: true, winner: "b", reason: "checkmate" });
  });
});

describe("chessCheckSquare", () => {
  test("is null when nobody is in check", () => {
    expect(chessCheckSquare(START)).toBeNull();
  });

  test("finds the mated king", () => {
    let fen = START;
    for (const [from, to] of [
      ["f2", "f3"],
      ["e7", "e5"],
      ["g2", "g4"],
      ["d8", "h4"],
    ]) {
      fen = chessApplyMove(fen, { from, to }).fen;
    }
    expect(chessCheckSquare(fen)).toBe("e1");
  });
});

describe("lazy clock", () => {
  const anchors = {
    whiteMs: CHESS_TIME_MS,
    blackMs: CHESS_TIME_MS,
    turn: "w",
    lastMoveAt: new Date("2026-09-14T12:00:00Z"),
  };

  test("deducts only the side to move", () => {
    const at = new Date("2026-09-14T12:01:30Z").getTime();
    expect(chessRemainingMs(anchors, "w", at)).toBe(CHESS_TIME_MS - 90000);
    expect(chessRemainingMs(anchors, "b", at)).toBe(CHESS_TIME_MS);
  });

  test("never goes negative and flags the winner", () => {
    const at = new Date("2026-09-14T12:30:00Z").getTime();
    expect(chessRemainingMs(anchors, "w", at)).toBe(0);
    expect(chessFlagWinner(anchors, at)).toBe("b");
  });

  test("no flag while time remains or clock never started", () => {
    expect(chessFlagWinner(anchors, new Date("2026-09-14T12:01:00Z").getTime())).toBeNull();
    expect(chessFlagWinner({ ...anchors, lastMoveAt: null })).toBeNull();
  });
});

describe("chessReasonLabel", () => {
  test("covers every terminal reason", () => {
    expect(chessReasonLabel("checkmate")).toBe("Checkmate");
    expect(chessReasonLabel("flag")).toBe("Won on time");
    expect(chessReasonLabel("resign")).toBe("Resignation");
    expect(chessReasonLabel("nope")).toBe("Finished");
  });
});
