"use client";

import { chessGlyph, fenToBoard } from "@/lib/games";

// Kivo Arena — tap chessboard.
//
// Flat monochrome squares (no gradients, no wood textures, no piece assets):
// text glyphs in currentColor, board coordinates on the edges, tap states via
// borders and dots. Orientation puts the viewer's color at the bottom.
//
// Props: fen, orientation ("w"|"b"), selected, targets (Set of squares),
// lastMove ({from,to} via SAN? pass lastFrom/lastTo), checkSquare,
// interactive (bool), onSquare(square).

function squareColor(square) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  return (file + rank) % 2 === 0 ? "dark" : "light";
}

export function ChessBoard({
  fen,
  orientation = "w",
  selected = null,
  targets = null,
  lastFrom = null,
  lastTo = null,
  checkSquare = null,
  interactive = true,
  onSquare,
}) {
  const cells = fenToBoard(fen);
  const ordered = orientation === "w" ? cells : [...cells].reverse();
  const targetSet = targets instanceof Set ? targets : new Set(targets || []);
  const bottomRank = orientation === "w" ? "1" : "8";
  const leftFile = orientation === "w" ? "a" : "h";

  return (
    <div
      className="grid w-full grid-cols-8 overflow-hidden rounded-2xl border border-[var(--border)]"
      style={{ aspectRatio: "1 / 1" }}
    >
      {ordered.map((cell) => {
        const dark = squareColor(cell.square) === "dark";
        const isSelected = selected === cell.square;
        const isTarget = targetSet.has(cell.square);
        const isLast = cell.square === lastFrom || cell.square === lastTo;
        const isCheck = checkSquare === cell.square;
        const glyph = cell.color ? chessGlyph(cell.color, cell.type) : "";
        return (
          <button
            key={cell.square}
            type="button"
            aria-label={`${cell.square}${glyph ? ` ${glyph}` : ""}`}
            disabled={!interactive}
            onClick={() => onSquare?.(cell.square)}
            className={`relative flex items-center justify-center transition-colors disabled:cursor-default ${
              dark ? "bg-[var(--bg-elevated)]" : "bg-[var(--bg-surface)]"
            } ${interactive ? "active:brightness-125" : ""}`}
            style={{ aspectRatio: "1 / 1" }}
          >
            {isLast && (
              <span
                aria-hidden
                className="absolute inset-0 bg-[var(--accent)]/15"
              />
            )}
            {isSelected && (
              <span
                aria-hidden
                className="absolute inset-0 border-[3px] border-[var(--accent)]"
              />
            )}
            {isCheck && (
              <span
                aria-hidden
                className="absolute inset-0 bg-[var(--destructive)]/30"
              />
            )}
            {glyph ? (
              <span
                aria-hidden
                className={`relative text-[clamp(1.4rem,7.5vw,2.6rem)] leading-none select-none ${
                  cell.color === "w"
                    ? "text-[var(--text-primary)]"
                    : "text-[var(--text-muted)]"
                }`}
                style={
                  cell.color === "b"
                    ? { textShadow: "0 0 1px currentColor" }
                    : undefined
                }
              >
                {glyph}
              </span>
            ) : null}
            {isTarget && (
              <span
                aria-hidden
                className={`absolute rounded-full ${
                  glyph
                    ? "inset-0 border-4 border-[var(--accent)]/70"
                    : "size-[26%] bg-[var(--accent)]/70"
                }`}
              />
            )}
            {cell.square[1] === bottomRank && (
              <span
                aria-hidden
                className="absolute bottom-0.5 right-1 text-[9px] font-semibold leading-none text-[var(--text-muted)]/70"
              >
                {cell.square[0]}
              </span>
            )}
            {cell.square[0] === leftFile && (
              <span
                aria-hidden
                className="absolute left-1 top-0.5 text-[9px] font-semibold leading-none text-[var(--text-muted)]/70"
              >
                {cell.square[1]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default ChessBoard;
