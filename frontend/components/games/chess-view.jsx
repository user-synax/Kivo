"use client";

import { ArrowLeft, Crown, Flag, Scale, Trophy } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChessBoard } from "@/components/games/chess-board";
import { SeriesRematchCard } from "@/components/games/series-rematch-card";
import { apiGet, apiPost } from "@/lib/api";
import {
  chessClockAt,
  chessEndReasonLabel,
  chessGlyph,
  formatChessClock,
  gameIsActive,
  gameIsCancelled,
  gameIsFinished,
  initialsFor,
  isMyChessTurn,
  joinedPlayers,
  myChessColor,
  playerFor,
} from "@/lib/games";
import { playChessMove, playClick } from "@/lib/sound";

// Kivo Arena — Chess stage.
//
// Server owns the board, clocks and results; this view renders + reports taps.
// Clocks animate locally from the server's lazy anchors (remaining exact at
// `asOf`, only the side to move burns after) and the server re-derives on
// every move and read — a game nobody opens costs the backend nothing.
// Flat surfaces + lucide icons only — no gradients, no emojis.

const PROMO_LABELS = { q: "Queen", r: "Rook", b: "Bishop", n: "Knight" };

function PromoBar({ promo, myColor, onPick, onCancel }) {
  if (!promo) return null;
  return (
    <div className="absolute inset-x-0 bottom-2 flex justify-center">
      <div className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)]/95 p-1.5 shadow-xl backdrop-blur-md">
        {promo.options.map((piece) => (
          <button
            key={piece}
            type="button"
            title={PROMO_LABELS[piece] || piece}
            aria-label={`Promote to ${PROMO_LABELS[piece] || piece}`}
            onClick={() => onPick(piece)}
            className="flex size-11 items-center justify-center rounded-full bg-[var(--bg-surface)] text-2xl text-[var(--text-primary)] transition-transform hover:scale-105 active:scale-95"
          >
            <span aria-hidden>{chessGlyph(myColor || "w", piece)}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel promotion"
          className="px-2 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ResignButton({ armed, busy, onResign, centered }) {
  return (
    <button
      type="button"
      onClick={onResign}
      disabled={busy}
      className={`flex min-h-[40px] items-center gap-1.5 rounded-full border px-4 py-2 text-[12.5px] font-semibold transition-all active:scale-95 disabled:opacity-50 ${
        centered ? "mx-auto" : ""
      } ${
        armed
          ? "border-[var(--destructive)]/50 bg-[var(--destructive)]/10 text-[var(--destructive)]"
          : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      }`}
    >
      <Flag className="h-3.5 w-3.5" />
      {armed ? "Tap again to resign" : "Resign"}
    </button>
  );
}

function PlayerRow({ name, clockMs, toMove, isMe, lowTime, icon }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[11px] font-bold text-[var(--accent)]">
        {icon || initialsFor(name)}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--text-primary)]">
        {name || "Player"}
        {isMe ? " (you)" : ""}
      </span>
      {toMove && (
        <span className="size-2 shrink-0 rounded-full bg-emerald-500 animate-[kivo-race-pulse_1.2s_ease-in-out_infinite] motion-reduce:animate-none" />
      )}
      <span
        className={`shrink-0 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1 font-mono text-[12px] tabular-nums ${
          lowTime ? "font-bold text-amber-600" : "text-[var(--text-primary)]"
        }`}
      >
        {formatChessClock(clockMs)}
      </span>
    </div>
  );
}

export function ChessView({ session, viewerId, onClose, onSession }) {
  const [selected, setSelected] = useState(null);
  const [targets, setTargets] = useState([]);
  const [promo, setPromo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [resignArmed, setResignArmed] = useState(false);
  const movesEndRef = useRef(null);

  const sessionId = session?.id || null;
  const chess = session?.chess || null;

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset is keyed on race identity.
  useEffect(() => {
    setSelected(null);
    setTargets([]);
    setPromo(null);
    setError(null);
    setResignArmed(false);
  }, [sessionId]);

  // Latest onSession without re-arming timers every parent render.
  const onSessionRef = useRef(onSession);
  onSessionRef.current = onSession;

  // Tick clocks locally while the game runs; poll the game so flags and the
  // opponent's moves land even if a socket event is missed.
  useEffect(() => {
    if (!gameIsActive(session)) return undefined;
    const id = session?.id || null;
    if (!id) return undefined;
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(() => {
      apiGet(`/api/v1/games/${id}`)
        .then((data) => onSessionRef.current?.(data))
        .catch(() => {});
    }, 10000);
    return () => {
      clearInterval(clock);
      clearInterval(poll);
    };
  }, [session]);

  const moveCount = chess?.moves?.length || 0;
  useEffect(() => {
    if (moveCount === 0) return;
    movesEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [moveCount]);

  const myColor = myChessColor(session, viewerId);
  const orientation = myColor || "w";
  const active = gameIsActive(session);
  const myTurn = isMyChessTurn(session, viewerId);
  const iAmIn = Boolean(
    (session?.players || []).some(
      (p) => String(p.userId) === String(viewerId) && p.status === "joined",
    ),
  );

  const joined = joinedPlayers(session);
  const opponent =
    joined.find((p) => String(p.userId) !== String(viewerId)) || null;
  const me = playerFor(session, viewerId);
  const iWon = Boolean(
    session?.winnerId && String(session.winnerId) === String(viewerId),
  );
  const isDraw = gameIsFinished(session) && !session?.winnerId;
  const reasonText = chessEndReasonLabel(chess?.endReason);

  const targetSet = useMemo(() => new Set(targets.map((t) => t.to)), [targets]);
  const lastSan = chess?.moves?.length
    ? chess.moves[chess.moves.length - 1]
    : null;
  // Last-move squares are nice-to-have; derive cheaply from history is
  // server-side work — the SAN label below carries the same information.
  const whiteClock = chessClockAt(chess, "w", now);
  const blackClock = chessClockAt(chess, "b", now);

  const clearSelection = useCallback(() => {
    setSelected(null);
    setTargets([]);
    setPromo(null);
  }, []);

  const doMove = useCallback(
    async (from, to, promotion = null) => {
      if (!sessionId || busy) return;
      setBusy(true);
      setError(null);
      try {
        const updated = await apiPost(`/api/v1/games/${sessionId}/move`, {
          from,
          to,
          ...(promotion ? { promotion } : {}),
        });
        playChessMove();
        clearSelection();
        onSession?.(updated);
      } catch (e) {
        // ILLEGAL_MOVE on a stale board (opponent moved first) — resync.
        if (e?.code === "ILLEGAL_MOVE" || e?.code === "NOT_YOUR_TURN") {
          try {
            const fresh = await apiGet(`/api/v1/games/${sessionId}`);
            onSession?.(fresh);
          } catch {}
        }
        setError(e?.message || "Could not play that move");
        clearSelection();
      } finally {
        setBusy(false);
      }
    },
    [sessionId, busy, clearSelection, onSession],
  );

  const onSquare = async (square) => {
    if (!active || busy || promo || !iAmIn) return;
    // Tapped a highlighted destination.
    if (selected && targetSet.has(square)) {
      const options = targets.filter((t) => t.to === square);
      const promoOptions = [
        ...new Set(options.map((t) => t.promotion).filter(Boolean)),
      ];
      if (promoOptions.length > 0) {
        setPromo({ from: selected, to: square, options: promoOptions });
        return;
      }
      playClick();
      await doMove(selected, square);
      return;
    }
    // Tapped own piece — load its legal targets.
    playClick();
    try {
      const moves = await apiGet(
        `/api/v1/games/${sessionId}/moves?square=${encodeURIComponent(square)}`,
      );
      if (Array.isArray(moves) && moves.length > 0) {
        setSelected(square);
        setTargets(moves);
      } else {
        clearSelection();
      }
    } catch {
      clearSelection();
    }
  };

  const resign = async () => {
    if (!resignArmed) {
      playClick();
      setResignArmed(true);
      setTimeout(() => setResignArmed(false), 4000);
      return;
    }
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      playClick();
      const updated = await apiPost(`/api/v1/games/${sessionId}/resign`, {});
      onSession?.(updated);
    } catch (e) {
      setError(e?.message || "Could not resign");
    } finally {
      setBusy(false);
      setResignArmed(false);
    }
  };

  if (!session) return null;

  const movePairs = [];
  const sans = Array.isArray(chess?.moves) ? chess.moves : [];
  for (let i = 0; i < sans.length; i += 2) {
    movePairs.push({ n: i / 2 + 1, w: sans[i], b: sans[i + 1] || null });
  }

  return (
    <div className="fixed inset-0 z-50 flex h-[100dvh] flex-col overflow-hidden bg-[var(--bg-base)]">
      <div className="relative flex shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-elevated)]/90 px-3 py-2.5 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur-md md:px-5">
        <button
          type="button"
          onClick={() => {
            playClick();
            onClose?.();
          }}
          aria-label="Back to arena"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] transition-all hover:bg-[var(--hover)] hover:text-[var(--text-primary)] active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)]">
          <Crown className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1
            className="truncate text-[15px] font-semibold leading-tight tracking-tight text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            CHESS
          </h1>
          <p className="truncate text-[11px] leading-tight text-[var(--text-muted)]">
            {gameIsFinished(session)
              ? reasonText
              : gameIsCancelled(session)
                ? "Cancelled"
                : active
                  ? myTurn
                    ? chess?.inCheck
                      ? "Check — your move"
                      : "Your move"
                    : `${opponent?.displayName || "Opponent"} to move`
                  : "Waiting to begin"}
          </p>
        </div>
        {active && (
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
              myTurn
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                : "border-[var(--border)] text-[var(--text-muted)]"
            }`}
          >
            {myTurn ? "YOUR MOVE" : `MOVE ${sans.length + 1}`}
          </span>
        )}
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain md:overflow-hidden">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-5 md:h-full md:max-w-5xl md:px-6">
          {gameIsCancelled(session) ? (
            <p className="py-10 text-center text-sm text-[var(--text-muted)]">
              This game was cancelled.
            </p>
          ) : !chess?.fen ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-10 text-center">
              <p className="text-[14px] font-medium text-[var(--text-primary)]">
                Waiting for {opponent?.displayName || "your opponent"} to
                accept…
              </p>
              <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                Colors are drawn and clocks start the moment they join.
              </p>
            </div>
          ) : gameIsFinished(session) ? (
            <div className="t-panel-in flex flex-col gap-3">
              <div className="flex flex-col items-center gap-1 rounded-[28px] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-7 text-center shadow-xl">
                <span className="flex size-14 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] text-amber-500">
                  {isDraw ? (
                    <Scale className="h-7 w-7" />
                  ) : iWon ? (
                    <Trophy className="h-7 w-7" />
                  ) : (
                    <Crown className="h-7 w-7 text-[var(--text-muted)]" />
                  )}
                </span>
                <p
                  className="text-[24px] font-semibold tracking-tight text-[var(--text-primary)]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {isDraw
                    ? "Draw"
                    : iWon
                      ? "You won"
                      : `${(session.players || []).find((p) => String(p.userId) === String(session.winnerId))?.displayName || "Opponent"} won`}
                </p>
                <p className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1 text-[12px] font-bold text-[var(--text-primary)]">
                  {reasonText}
                  {lastSan ? ` · ${lastSan}` : ""}
                </p>
              </div>
              <SeriesRematchCard
                session={session}
                viewerId={viewerId}
                opponentId={opponent?.userId || null}
                opponentName={opponent?.displayName || null}
                onSession={onSession}
                onClose={onClose}
              />
            </div>
          ) : (
            <>
              {error && (
                <p className="text-center text-[12px] text-[var(--destructive)]">
                  {error}
                </p>
              )}

              {/* Mobile: stacked board + players, no move log. */}
              <div className="flex flex-col gap-3 md:hidden">
                <PlayerRow
                  name={opponent?.displayName}
                  clockMs={myColor === "w" ? blackClock : whiteClock}
                  toMove={active && !myTurn}
                  isMe={false}
                  lowTime={(myColor === "w" ? blackClock : whiteClock) < 60000}
                />
                <div className="relative">
                  <ChessBoard
                    fen={chess.fen}
                    orientation={orientation}
                    selected={selected}
                    targets={targetSet}
                    checkSquare={chess.checkSquare}
                    interactive={active && iAmIn && !busy}
                    onSquare={onSquare}
                  />
                  <PromoBar
                    promo={promo}
                    myColor={myColor}
                    onPick={(piece) => {
                      const { from, to } = promo;
                      setPromo(null);
                      doMove(from, to, piece);
                    }}
                    onCancel={() => setPromo(null)}
                  />
                </div>
                <PlayerRow
                  name={me?.displayName}
                  clockMs={myColor === "w" ? whiteClock : blackClock}
                  toMove={active && myTurn}
                  isMe
                  lowTime={(myColor === "w" ? whiteClock : blackClock) < 60000}
                />
                {active && iAmIn && (
                  <ResignButton
                    armed={resignArmed}
                    busy={busy}
                    onResign={resign}
                    centered
                  />
                )}
              </div>

              {/* Desktop: board fitted left, move log rail right — no scroll. */}
              <div className="hidden min-h-0 flex-1 md:grid md:grid-cols-[minmax(0,1fr)_300px] md:gap-4">
                <div className="flex min-h-0 min-w-0 items-center justify-center">
                  <div className="relative w-full max-w-[min(100%,calc(100dvh-150px))]">
                    <ChessBoard
                      fen={chess.fen}
                      orientation={orientation}
                      selected={selected}
                      targets={targetSet}
                      checkSquare={chess.checkSquare}
                      interactive={active && iAmIn && !busy}
                      onSquare={onSquare}
                    />
                    <PromoBar
                      promo={promo}
                      myColor={myColor}
                      onPick={(piece) => {
                        const { from, to } = promo;
                        setPromo(null);
                        doMove(from, to, piece);
                      }}
                      onCancel={() => setPromo(null)}
                    />
                  </div>
                </div>
                <div className="flex min-h-0 min-w-0 flex-col gap-3">
                  <div className="shrink-0">
                    <PlayerRow
                      name={opponent?.displayName}
                      clockMs={myColor === "w" ? blackClock : whiteClock}
                      toMove={active && !myTurn}
                      isMe={false}
                      lowTime={
                        (myColor === "w" ? blackClock : whiteClock) < 60000
                      }
                    />
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5">
                    <p className="mb-1.5 shrink-0 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      Moves
                      {sans.length > 0 && (
                        <span className="ml-1.5 font-semibold normal-case tracking-normal">
                          · {Math.ceil(sans.length / 2)}
                        </span>
                      )}
                    </p>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                      {sans.length === 0 ? (
                        <p className="py-4 text-center text-[12px] text-[var(--text-muted)]">
                          No moves yet — {myTurn ? "you start" : "waiting"}.
                        </p>
                      ) : (
                        <div className="grid grid-cols-[2.5rem_1fr_1fr] gap-y-1 text-[13px] tabular-nums">
                          {movePairs.map((pair) => (
                            <div key={pair.n} className="contents">
                              <span className="text-[var(--text-muted)]">
                                {pair.n}.
                              </span>
                              <span className="font-medium text-[var(--text-primary)]">
                                {pair.w}
                              </span>
                              <span className="font-medium text-[var(--text-primary)]">
                                {pair.b || ""}
                              </span>
                            </div>
                          ))}
                          <div ref={movesEndRef} />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <PlayerRow
                      name={me?.displayName}
                      clockMs={myColor === "w" ? whiteClock : blackClock}
                      toMove={active && myTurn}
                      isMe
                      lowTime={
                        (myColor === "w" ? whiteClock : blackClock) < 60000
                      }
                    />
                  </div>
                  {active && iAmIn && (
                    <div className="shrink-0">
                      <ResignButton
                        armed={resignArmed}
                        busy={busy}
                        onResign={resign}
                        centered
                      />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChessView;
