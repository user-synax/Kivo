"use client";

import {
  ArrowLeft,
  Bot,
  Keyboard,
  Loader2,
  RotateCcw,
  Swords,
  Trophy,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import {
  formatAccuracy,
  formatClock,
  formatGap,
  formatMs,
  formatWpm,
  gameIsActive,
  gameIsCancelled,
  gameIsFinished,
  gameResults,
  getCountdownMs,
  initialsFor,
  isBotPlayer,
  isInGame,
  isPracticeGame,
  joinedPlayers,
  playerFor,
  practiceDifficultyFor,
  progressPercent,
  RACE_DANGER_PCT,
  raceMarginMs,
  runnerUpProgress,
  seriesKeyFor,
  seriesScoreText,
} from "@/lib/games";
import {
  playClick,
  playCountdownCue,
  playJoin,
  playTypeTick,
} from "@/lib/sound";

// Kivo Arena — Typing Race stage.
// Server owns passage/clock/places; this view renders + reports progress.
// Countdown is anchored to server `startedAt` + server `countdownMs`.
// NOTE: no gradients, no emojis here — flat surfaces + lucide icons only.

const PROGRESS_STEP = 0.05;
const PROGRESS_MIN_INTERVAL_MS = 250;

const KEYFRAMES = `@keyframes kivo-race-count-in {
  0% { opacity: 0; transform: scale(0.55); }
  45% { opacity: 1; transform: scale(1.14); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes kivo-race-nearly {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
@keyframes kivo-race-pulse {
  0%,100% { opacity: 1; }
  50% { opacity: 0.5; }
}`;

function longestMatchPrefix(typed, passage) {
  const max = Math.min(typed.length, passage.length);
  let i = 0;
  while (i < max && typed[i] === passage[i]) i += 1;
  return i;
}

function PassageDisplay({ passage, typed }) {
  const matched = longestMatchPrefix(typed, passage);
  return (
    <p className="select-none font-mono text-[17px] leading-relaxed tracking-tight">
      {[...passage].map((char, i) => {
        let cls = "text-[var(--text-muted)]";
        if (i < typed.length) {
          cls =
            i < matched
              ? "text-[var(--text-primary)] bg-emerald-500/15 rounded-[3px]"
              : "rounded-[3px] bg-[var(--destructive)]/25 text-[var(--destructive)]";
        }
        const isCursor = i === typed.length;
        return (
          <span
            key={`${i}-${char}`}
            className={`${cls} ${isCursor ? "rounded-[3px] bg-[var(--accent)]/30 outline outline-1 outline-[var(--accent)]/50" : ""}`}
          >
            {char}
          </span>
        );
      })}
    </p>
  );
}

export function TypingRaceView({ session, viewerId, onClose, onSession }) {
  const [typed, setTyped] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const inputRef = useRef(null);
  const lastSentRef = useRef(0);
  const lastSentAtRef = useRef(0);
  const finishedRef = useRef(false);
  // Best-of series state for the result screen. Fetched once the race is
  // finished and re-polled so an opponent's rematch appears without a refresh.
  const [series, setSeries] = useState(null);
  const [rematchBusy, setRematchBusy] = useState(false);
  const [rematchError, setRematchError] = useState(null);
  // Practice difficulty selector on the practice result card.
  const [practiceDifficulty, setPracticeDifficulty] = useState(
    () => session?.botDifficulty || "medium",
  );

  const sessionId = session?.id || null;
  const startedAt = session?.startedAt || null;
  const countdownMs = getCountdownMs(session);

  const goAtMs = startedAt ? new Date(startedAt).getTime() : 0;
  const countdownMsLeft = goAtMs ? Math.min(countdownMs, goAtMs - now) : 0;
  const countdownActive = countdownMsLeft > 0 && gameIsActive(session);
  const countdownStep = countdownActive ? Math.ceil(countdownMsLeft / 1000) : 0;

  const lastStepRef = useRef(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset is keyed on race identity, not on values read inside.
  useEffect(() => {
    setTyped("");
    lastSentRef.current = 0;
    finishedRef.current = false;
    lastStepRef.current = null;
    setRematchError(null);
    setPracticeDifficulty(session?.botDifficulty || "medium");
  }, [sessionId, startedAt]);

  useEffect(() => {
    if (!gameIsActive(session)) return undefined;
    const timer = setInterval(
      () => setNow(Date.now()),
      countdownActive ? 50 : 250,
    );
    return () => clearInterval(timer);
  }, [session, countdownActive]);

  useEffect(() => {
    if (!gameIsActive(session)) {
      lastStepRef.current = null;
      return;
    }
    const step = countdownActive ? countdownStep : 0;
    if (lastStepRef.current === step) return;
    const previous = lastStepRef.current;
    lastStepRef.current = step;
    if (step > 0) playCountdownCue("countdown");
    else if (previous !== null && previous > 0) playCountdownCue("go");
  }, [session, countdownActive, countdownStep]);

  useEffect(() => {
    if (
      countdownActive ||
      !gameIsActive(session) ||
      !isInGame(session, viewerId)
    ) {
      return undefined;
    }
    const t = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(t);
  }, [session, viewerId, countdownActive]);

  // Best-of series: load once finished, re-poll so the opponent's rematch
  // invite surfaces on this screen without leaving it. Practice races have no
  // series — they poll the game itself instead (see below).
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on race identity + status; session object identity churns on every progress event.
  useEffect(() => {
    if (!gameIsFinished(session) || isPracticeGame(session)) {
      setSeries(null);
      return undefined;
    }
    const key = seriesKeyFor(session);
    if (!key) return undefined;
    let cancelled = false;
    const load = () => {
      apiGet(`/api/v1/games/series/${key}`)
        .then((data) => {
          if (!cancelled) setSeries(data);
        })
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [sessionId, session?.status]);

  // Practice: the bot only moves when the server looks at it, so poll while
  // the race runs — this is what settles an idle player's loss, and keeps the
  // bot bar honest between the player's own keystroke pings.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on race identity + status; session object identity churns on every progress event.
  useEffect(() => {
    if (!isPracticeGame(session) || !gameIsActive(session)) return undefined;
    const timer = setInterval(() => {
      apiGet(`/api/v1/games/${sessionId}`)
        .then((data) => onSession?.(data))
        .catch(() => {});
    }, 2000);
    return () => clearInterval(timer);
  }, [sessionId, session?.status]);

  const passage = session?.passage || "";
  const iAmIn = isInGame(session, viewerId);
  const active = gameIsActive(session);
  const canType = active && iAmIn && !countdownActive;

  const matched = useMemo(
    () => (passage ? longestMatchPrefix(typed, passage) : 0),
    [typed, passage],
  );
  const accuracy = typed.length ? (matched / typed.length) * 100 : 100;
  const progress = passage ? Math.min(1, matched / passage.length) : 0;
  const myPlayer = playerFor(session, viewerId);
  const iFinished = Boolean(myPlayer?.finishedAt);

  const elapsedMs = startedAt
    ? Math.max(0, now - new Date(startedAt).getTime())
    : 0;

  const liveWpm = useMemo(() => {
    if (!passage || !elapsedMs) return 0;
    const wpm = passage.length / 5 / (elapsedMs / 60000);
    return Number.isFinite(wpm) ? Math.round(wpm) : 0;
  }, [passage, elapsedMs]);

  const reportProgress = useCallback(
    (value) => {
      if (!sessionId) return;
      const nowMs = Date.now();
      const isFinal = value >= 1;
      if (
        !isFinal &&
        (Math.abs(value - lastSentRef.current) < PROGRESS_STEP ||
          nowMs - lastSentAtRef.current < PROGRESS_MIN_INTERVAL_MS)
      ) {
        return;
      }
      lastSentRef.current = value;
      lastSentAtRef.current = nowMs;
      apiPost(`/api/v1/games/${sessionId}/progress`, {
        progress: Number(value.toFixed(3)),
      }).catch(() => {});
    },
    [sessionId],
  );

  const handleChange = (e) => {
    if (!canType || iFinished) return;
    const next = e.target.value;
    if (next.length > passage.length) return;
    setTyped(next);

    const nextMatched = longestMatchPrefix(next, passage);
    if (nextMatched > matched && nextMatched % 4 === 0) playTypeTick();
    reportProgress(passage ? nextMatched / passage.length : 0);

    if (
      nextMatched === passage.length &&
      passage.length > 0 &&
      !finishedRef.current
    ) {
      finishedRef.current = true;
      apiPost(`/api/v1/games/${sessionId}/finish`, {
        accuracy: Math.round((nextMatched / next.length) * 100 * 10) / 10,
        elapsedMs: Math.max(
          0,
          Date.now() - new Date(startedAt || Date.now()).getTime(),
        ),
      })
        .then((updated) => onSession?.(updated))
        .catch(() => {
          finishedRef.current = false;
        });
    }
  };

  if (!session) return null;

  const joined = joinedPlayers(session);
  const results = gameResults(session);
  const winner = results[0] || null;
  const iWon = Boolean(winner && winner.userId === viewerId);
  const finishedIds = new Set(results.map((p) => p.userId));
  const resultRows = [
    ...results,
    ...joined.filter((p) => !finishedIds.has(p.userId)),
  ];

  const opponent = joined.find((p) => p.userId !== viewerId) || null;
  const opponentNearlyDone = Boolean(
    opponent &&
      active &&
      !countdownActive &&
      progressPercent(opponent) >= RACE_DANGER_PCT,
  );

  const margin = raceMarginMs(session);
  const runnerUp = runnerUpProgress(session);
  const runnerUpPct = runnerUp ? Math.round(runnerUp.progress * 100) : 0;
  const closenessText =
    margin != null
      ? `Won by ${formatGap(margin)}`
      : runnerUp
        ? runnerUp.player.userId === viewerId
          ? `You reached ${runnerUpPct}%`
          : `${runnerUp.player.displayName || "The other player"} reached ${runnerUpPct}%`
        : null;
  const photoFinish =
    margin != null ? margin < 1500 : Boolean(runnerUp && runnerUpPct >= 90);

  // Best-of series derived state for the result screen.
  const opponentId = opponent?.userId || null;
  const seriesDone = Boolean(series?.isComplete);
  const seriesGames = Array.isArray(series?.games) ? series.games : [];
  const bestOf = Number(series?.bestOf) || 3;
  // A live rematch in this series (pending/active, different game): the
  // one-tap target when the opponent already hit Rematch.
  const liveRematch = seriesGames.find(
    (g) =>
      g?.id !== sessionId &&
      (g?.status === "pending" || g?.status === "active"),
  );
  const liveRematchInvitesMe =
    Boolean(liveRematch) &&
    (liveRematch.players || []).some(
      (p) => String(p.userId) === String(viewerId) && p.status === "invited",
    );
  const nextRound = series ? seriesGames.length + 1 : 2;

  const requestRematch = async () => {
    if (!sessionId || rematchBusy) return;
    setRematchBusy(true);
    setRematchError(null);
    try {
      playClick();
      const next = await apiPost(`/api/v1/games/${sessionId}/rematch`, {});
      playJoin();
      onSession?.(next);
    } catch (e) {
      // Both tapped at once: a live game already exists in this thread.
      // Open it instead of stranding the player on an error.
      if (
        e?.code === "GAME_EXISTS" ||
        /already a game going/i.test(e?.message || "")
      ) {
        try {
          const mine = await apiGet("/api/v1/games/mine");
          const found = (Array.isArray(mine) ? mine : []).find(
            (g) =>
              String(g?.conversationId) === String(session?.conversationId),
          );
          if (found) {
            playJoin();
            onSession?.(found);
            return;
          }
        } catch {}
      }
      setRematchError(e?.message || "Could not start a rematch");
    } finally {
      setRematchBusy(false);
    }
  };

  const joinRematch = async () => {
    if (!liveRematch || rematchBusy) return;
    setRematchBusy(true);
    setRematchError(null);
    try {
      playJoin();
      const next = await apiPost(`/api/v1/games/${liveRematch.id}/join`, {});
      onSession?.(next);
    } catch (e) {
      setRematchError(e?.message || "Could not join the rematch");
    } finally {
      setRematchBusy(false);
    }
  };

  // Practice: instant new race at the selected difficulty — no invite, no wait.
  const raceAgain = async () => {
    if (rematchBusy) return;
    setRematchBusy(true);
    setRematchError(null);
    try {
      playJoin();
      const next = await apiPost("/api/v1/games/practice", {
        difficulty: practiceDifficulty,
      });
      onSession?.(next);
    } catch (e) {
      setRematchError(e?.message || "Could not start practice");
    } finally {
      setRematchBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex h-[100dvh] flex-col overflow-hidden bg-[var(--bg-base)]">
      <style>{KEYFRAMES}</style>

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
          <Keyboard className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1
            className="truncate text-[15px] font-semibold leading-tight tracking-tight text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            TYPING RACE
          </h1>
          <p className="truncate text-[11px] leading-tight text-[var(--text-muted)]">
            {gameIsFinished(session)
              ? iWon
                ? "You won — loud."
                : `${winner?.displayName || "Opponent"} won`
              : gameIsCancelled(session)
                ? "Cancelled"
                : countdownActive
                  ? "Get ready…"
                  : active
                    ? "Type the passage fastest"
                    : "Waiting to begin"}
          </p>
        </div>
        {active && (
          <div className="flex shrink-0 items-center gap-1.5">
            {isPracticeGame(session) && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] font-bold text-[var(--text-muted)]">
                <Bot className="h-3 w-3" />
                {practiceDifficultyFor(session.botDifficulty).label}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border)] px-2.5 py-1 font-mono text-[12px] tabular-nums text-[var(--text-primary)]">
              <Zap className="h-3 w-3 text-amber-500" />
              {liveWpm}
            </span>
            <span className="rounded-full bg-[var(--bg-surface)] border border-[var(--border)] px-2.5 py-1 font-mono text-[12px] tabular-nums text-[var(--text-muted)]">
              {formatClock(elapsedMs)}
            </span>
          </div>
        )}
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex w-full max-w-3xl flex-col px-4 py-5 md:px-6 md:py-7">
          {gameIsCancelled(session) ? (
            <p className="py-10 text-center text-sm text-[var(--text-muted)]">
              This race was cancelled.
            </p>
          ) : gameIsFinished(session) ? (
            <div className="t-panel-in flex flex-col gap-3">
              <div className="relative flex flex-col items-center gap-1 overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-7 text-center shadow-xl">
                {photoFinish && (
                  <span className="mb-1 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Photo finish
                  </span>
                )}
                <span className="flex size-14 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] text-amber-500">
                  <Trophy className="h-7 w-7" />
                </span>
                <p
                  className="text-[24px] font-semibold tracking-tight text-[var(--text-primary)]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {iWon ? "You won" : `${winner?.displayName || "Someone"} won`}
                </p>
                <p className="text-[13px] text-[var(--text-muted)]">
                  {formatWpm(winner?.wpm)} · {formatAccuracy(winner?.accuracy)}{" "}
                  · {formatMs(winner?.elapsedMs)}
                </p>
                {closenessText && (
                  <p className="mt-1 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1 text-[13px] font-bold text-[var(--text-primary)]">
                    {closenessText}
                  </p>
                )}
              </div>

              {/* Practice: instant race-again + difficulty switch. No series. */}
              {isPracticeGame(session) ? (
                <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      <Bot className="h-3.5 w-3.5" /> Practice ·{" "}
                      {practiceDifficultyFor(practiceDifficulty).label}
                    </p>
                    <p className="truncate text-[12px] font-semibold text-[var(--text-primary)]">
                      {iWon
                        ? `You beat ${opponent?.displayName || "the bot"}`
                        : `${opponent?.displayName || "The bot"} won this one`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {["easy", "medium", "hard"].map((id) => {
                      const d = practiceDifficultyFor(id);
                      const selected = practiceDifficulty === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            playClick();
                            setPracticeDifficulty(id);
                          }}
                          aria-pressed={selected}
                          className={`h-8 flex-1 rounded-full border px-2 text-[11.5px] font-bold transition-all active:scale-95 ${
                            selected
                              ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-base)]"
                              : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                          }`}
                        >
                          {d.label} · {d.wpm}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={raceAgain}
                      disabled={rematchBusy}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-3.5 py-2.5 text-[13px] font-semibold text-black transition-all hover:brightness-90 active:scale-95 disabled:opacity-50 min-h-[42px]"
                    >
                      {rematchBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                      Race again
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        onClose?.();
                      }}
                      className="shrink-0 rounded-full border border-[var(--border)] px-3.5 py-2.5 text-[12.5px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)] min-h-[42px]"
                    >
                      Arena
                    </button>
                  </div>
                  {rematchError && (
                    <p className="text-[12px] text-[var(--destructive)]">
                      {rematchError}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                  {/* Best-of series + one-tap rematch — same DM thread. */}
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      <Swords className="h-3.5 w-3.5" /> Best of {bestOf}
                    </p>
                    {series && (
                      <p className="truncate text-[12px] font-semibold text-[var(--text-primary)]">
                        {seriesScoreText(series, viewerId, opponentId)}
                      </p>
                    )}
                  </div>

                  {/* Round dots: per-game winner, flat pills, icons only. */}
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: bestOf }).map((_, i) => {
                      const g = seriesGames[i];
                      const w = g?.winnerId || null;
                      const mine = w && String(w) === String(viewerId);
                      const theirs = w && !mine;
                      return (
                        <span
                          key={g?.id || `round-${i}`}
                          title={
                            g
                              ? `Game ${i + 1}: ${mine ? "you won" : theirs ? `${opponent?.displayName || "opponent"} won` : "no result"}`
                              : `Game ${i + 1}: not played`
                          }
                          className={`flex h-7 min-w-0 flex-1 items-center justify-center gap-1 rounded-full border px-2 text-[11px] font-bold tabular-nums ${
                            mine
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                              : theirs
                                ? "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-muted)]"
                                : i === seriesGames.length
                                  ? "border-dashed border-[var(--accent)]/50 text-[var(--accent)]"
                                  : "border-[var(--border)] text-[var(--text-muted)]/50"
                          }`}
                        >
                          G{i + 1} · {mine ? "W" : theirs ? "L" : "–"}
                        </span>
                      );
                    })}
                  </div>

                  {seriesDone ? (
                    <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2.5">
                      <Trophy className="h-5 w-5 shrink-0 text-amber-500" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-[var(--text-primary)]">
                          {series?.winnerId &&
                          String(series.winnerId) === String(viewerId)
                            ? "Series yours"
                            : "Series decided"}
                        </p>
                        <p className="truncate text-[11px] text-[var(--text-muted)]">
                          Invite again from the arena for a fresh series
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          onClose?.();
                        }}
                        className="shrink-0 rounded-full bg-white px-3.5 py-2 text-[12.5px] font-semibold text-black transition-all hover:brightness-90 active:scale-95"
                      >
                        Arena
                      </button>
                    </div>
                  ) : liveRematch ? (
                    <div className="flex items-center gap-3 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/[0.06] px-3 py-2.5">
                      <RotateCcw className="h-5 w-5 shrink-0 text-[var(--accent)]" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-[var(--text-primary)]">
                          {liveRematchInvitesMe
                            ? `${opponent?.displayName || "Opponent"} wants a rematch`
                            : `Game ${liveRematch.round || nextRound} waiting`}
                        </p>
                        <p className="truncate text-[11px] text-[var(--text-muted)]">
                          Same chat thread · first to{" "}
                          {Number(series?.winsNeeded) || 2}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={
                          liveRematchInvitesMe
                            ? joinRematch
                            : () => onSession?.(liveRematch)
                        }
                        disabled={rematchBusy}
                        className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[12.5px] font-semibold text-black transition-all hover:brightness-90 active:scale-95 disabled:opacity-50"
                      >
                        {rematchBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5" />
                        )}
                        {liveRematchInvitesMe ? "Accept" : "Open"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={requestRematch}
                        disabled={rematchBusy}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-3.5 py-2.5 text-[13px] font-semibold text-black transition-all hover:brightness-90 active:scale-95 disabled:opacity-50 min-h-[42px]"
                      >
                        {rematchBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4" />
                        )}
                        Rematch · Game {nextRound > bestOf ? bestOf : nextRound}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          onClose?.();
                        }}
                        className="shrink-0 rounded-full border border-[var(--border)] px-3.5 py-2.5 text-[12.5px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)] min-h-[42px]"
                      >
                        Arena
                      </button>
                    </div>
                  )}
                  {rematchError && (
                    <p className="text-[12px] text-[var(--destructive)]">
                      {rematchError}
                    </p>
                  )}
                  {!series && (
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Loading series…
                    </p>
                  )}
                </div>
              )}
              {resultRows.map((p) => {
                const finished = p.place != null;
                return (
                  <div
                    key={p.userId}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                      p.userId === viewerId
                        ? "border-[var(--accent)]/40 bg-[var(--accent)]/[0.07]"
                        : "border-[var(--border)] bg-[var(--bg-surface)]"
                    }`}
                  >
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                        finished && p.place === 1
                          ? "bg-amber-500/20 text-amber-600"
                          : "bg-[var(--accent)]/15 text-[var(--accent)]"
                      }`}
                    >
                      {finished ? p.place : "–"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[var(--text-primary)]">
                      {p.displayName || "Player"}
                      {p.userId === viewerId ? " (you)" : ""}
                    </span>
                    <span className="shrink-0 text-[12px] tabular-nums text-[var(--text-muted)]">
                      {finished
                        ? `${formatWpm(p.wpm)} · ${formatAccuracy(p.accuracy)} · ${formatMs(p.elapsedMs)}`
                        : `${progressPercent(p)}% typed`}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <div
                className={`relative rounded-[24px] border bg-[var(--bg-surface)] p-4 transition-colors md:p-5 ${
                  countdownActive
                    ? "border-[var(--border)]"
                    : "border-[var(--accent)]/30"
                }`}
              >
                <div
                  className={
                    countdownActive
                      ? "pointer-events-none select-none opacity-40 blur-[3px]"
                      : ""
                  }
                >
                  {passage ? (
                    <PassageDisplay passage={passage} typed={typed} />
                  ) : (
                    <p className="py-6 text-center text-sm text-[var(--text-muted)]">
                      Waiting for the race to start…
                    </p>
                  )}
                </div>
                {countdownActive && (
                  <div
                    aria-hidden
                    className="absolute inset-0 flex flex-col items-center justify-center gap-1.5"
                  >
                    <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--text-muted)]">
                      Get ready
                    </span>
                    <span
                      key={countdownStep}
                      className="text-[68px] font-semibold leading-none tabular-nums text-[var(--text-primary)] animate-[kivo-race-count-in_360ms_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {countdownStep}
                    </span>
                    <span className="rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] px-3 py-1 text-[11px] text-[var(--text-muted)]">
                      Typing unlocks on GO
                    </span>
                  </div>
                )}
              </div>

              <input
                ref={inputRef}
                value={typed}
                onChange={handleChange}
                disabled={!canType || iFinished}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder={
                  !iAmIn
                    ? "You are not in this race"
                    : iFinished
                      ? "You finished — waiting for your opponent…"
                      : countdownActive
                        ? "Get ready…"
                        : active
                          ? "Start typing…"
                          : "Waiting for your opponent…"
                }
                className="mt-4 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3.5 font-mono text-[15px] text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-soft,rgba(75,169,225,0.15))] disabled:opacity-60"
              />

              <div className="mt-2 flex items-center justify-between text-[12px] tabular-nums text-[var(--text-muted)]">
                <span>
                  Accuracy{" "}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {Math.round(accuracy)}%
                  </span>
                </span>
                <span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {liveWpm}
                  </span>{" "}
                  wpm · {Math.round(progress * 100)}%
                </span>
              </div>
            </>
          )}

          {!gameIsFinished(session) && !gameIsCancelled(session) && (
            <div className="mt-6">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Racers
              </p>
              <div className="flex flex-col gap-2">
                {joined.map((p) => {
                  const isMe = p.userId === viewerId;
                  const pct =
                    isMe && active
                      ? Math.round(progress * 100)
                      : progressPercent(p);
                  const nearlyDone =
                    active &&
                    !countdownActive &&
                    pct >= RACE_DANGER_PCT &&
                    pct < 100;
                  return (
                    <div
                      key={p.userId}
                      className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${
                        isMe
                          ? "border-[var(--accent)]/30 bg-[var(--accent)]/[0.06]"
                          : "border-[var(--border)] bg-[var(--bg-surface)]"
                      }`}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[11px] font-bold text-[var(--accent)]">
                        {isBotPlayer(p) ? (
                          <Bot className="h-4 w-4" />
                        ) : (
                          initialsFor(p.displayName)
                        )}
                      </span>
                      <span className="w-28 shrink-0 truncate text-[13px] font-medium text-[var(--text-primary)]">
                        {p.displayName || "Player"}
                        {isMe ? " (you)" : ""}
                      </span>
                      <span className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                        <span
                          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-200 ${
                            nearlyDone
                              ? "bg-amber-500 animate-[kivo-race-nearly_1s_ease-in-out_infinite] motion-reduce:animate-none"
                              : isMe
                                ? "bg-[var(--text-primary)]"
                                : "bg-[var(--text-muted)]"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                      <span
                        className={`w-11 shrink-0 text-right text-[12px] tabular-nums font-semibold ${
                          nearlyDone
                            ? "text-amber-600"
                            : "text-[var(--text-muted)]"
                        }`}
                      >
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {active && iAmIn && (
        <div className="relative shrink-0 border-t border-[var(--border)] bg-[var(--bg-elevated)]/60 px-4 pb-[max(env(safe-area-inset-bottom),0.6rem)] pt-2.5 text-center text-[11.5px] text-[var(--text-muted)] backdrop-blur-md">
          {iFinished || finishedRef.current ? (
            <span className="flex items-center justify-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Waiting for your
              opponent…
            </span>
          ) : countdownActive ? (
            "Go the instant the passage clears"
          ) : opponentNearlyDone ? (
            <span className="font-bold text-amber-600 animate-[kivo-race-pulse_1s_ease-in-out_infinite] motion-reduce:animate-none">
              {opponent?.displayName || "Your opponent"} is nearly there — keep
              typing!
            </span>
          ) : (
            "Type exactly — mistakes stall your progress"
          )}
        </div>
      )}
    </div>
  );
}

export default TypingRaceView;
