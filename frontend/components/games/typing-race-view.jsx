"use client";

import { ArrowLeft, Loader2, Trophy } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiPost } from "@/lib/api";
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
  initialsFor,
  isInGame,
  joinedPlayers,
  playerFor,
  progressPercent,
  RACE_COUNTDOWN_MS,
  RACE_DANGER_PCT,
  raceMarginMs,
  runnerUpProgress,
} from "@/lib/games";
import { playCountdownCue } from "@/lib/sound";

// Kivo Games — full-screen Typing Race.
//
// The server owns the passage, the start time, and finish places. This view only
// renders that state and reports the player's own progress; it never decides who
// won. Accuracy is derived locally for the live readout, and the server
// re-derives WPM from its own clock when the race finishes.

// Progress is paced, not per-keystroke: the viewer's own bar renders locally, so
// these pings only need to keep the opponent's bar reasonably honest.
const PROGRESS_STEP = 0.05;
const PROGRESS_MIN_INTERVAL_MS = 250;

// The countdown number pops in on every step, and a bar that is nearly finished
// breathes so a tight endgame reads as tense instead of as a static percentage.
const KEYFRAMES = `@keyframes kivo-race-count-in {
  0% { opacity: 0; transform: scale(0.55); }
  45% { opacity: 1; transform: scale(1.14); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes kivo-race-nearly {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
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
              ? "text-[var(--accent)]"
              : "rounded-sm bg-[var(--destructive)]/25 text-[var(--destructive)]";
        }
        const isCursor = i === typed.length;
        return (
          <span
            key={`${i}-${char}`}
            className={`${cls} ${isCursor ? "rounded-sm bg-[var(--accent)]/30" : ""}`}
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

  const sessionId = session?.id || null;
  const startedAt = session?.startedAt || null;

  // The server stamps `startedAt` RACE_COUNTDOWN_MS in the future, so both players
  // count down to the same absolute moment and the race clock, the live WPM and
  // the input all begin together on "GO". Deriving it from that timestamp — rather
  // than from a local timer — means opening a race that is already running shows no
  // countdown, and a late joiner gets exactly the time that is left.
  const goAtMs = startedAt ? new Date(startedAt).getTime() : 0;
  // Clamped to the real countdown length, so a device clock that is badly out of
  // step with the server can never turn this into a minute-long wait.
  const countdownMsLeft = goAtMs
    ? Math.min(RACE_COUNTDOWN_MS, goAtMs - now)
    : 0;
  const countdownActive = countdownMsLeft > 0 && gameIsActive(session);
  const countdownStep = countdownActive ? Math.ceil(countdownMsLeft / 1000) : 0;

  const lastStepRef = useRef(null);

  // A new race (or a restart) resets local typing state. Keyed on race identity:
  // the effect deliberately reads nothing, it only reacts to the identity change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset is keyed on race identity, not on values read inside.
  useEffect(() => {
    setTyped("");
    lastSentRef.current = 0;
    finishedRef.current = false;
    lastStepRef.current = null;
  }, [sessionId, startedAt]);

  // Tick the clock while a race runs so the timer and live WPM stay honest — and
  // tick faster through the countdown so the numbers land on the beat.
  useEffect(() => {
    if (!gameIsActive(session)) return undefined;
    const timer = setInterval(
      () => setNow(Date.now()),
      countdownActive ? 50 : 250,
    );
    return () => clearInterval(timer);
  }, [session, countdownActive]);

  // Countdown audio: one blip per number, then a brighter "GO" on the transition.
  // `lastStepRef` starts null, so merely opening an in-progress race stays silent —
  // the cue only fires when this client actually watched the countdown run.
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

  // Focus only once typing is actually unlocked, so no keystroke can land before GO.
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

  const passage = session?.passage || "";
  const iAmIn = isInGame(session, viewerId);
  const active = gameIsActive(session);
  // Typing is unlocked by the countdown finishing, not by the race merely existing.
  const canType = active && iAmIn && !countdownActive;

  const matched = useMemo(
    () => (passage ? longestMatchPrefix(typed, passage) : 0),
    [typed, passage],
  );
  const accuracy = typed.length ? (matched / typed.length) * 100 : 100;
  // Local progress drives the viewer's own bar so typing feels instant; the
  // server pings below only keep the opponent's bar honest.
  const progress = passage ? Math.min(1, matched / passage.length) : 0;
  const myPlayer = playerFor(session, viewerId);
  const iFinished = Boolean(myPlayer?.finishedAt);

  // Clamped at 0 through the countdown, so the clock and live WPM read 0:00 / 0
  // until typing actually unlocks.
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
      const now = Date.now();
      const isFinal = value >= 1;
      if (
        !isFinal &&
        (Math.abs(value - lastSentRef.current) < PROGRESS_STEP ||
          now - lastSentAtRef.current < PROGRESS_MIN_INTERVAL_MS)
      ) {
        return;
      }
      lastSentRef.current = value;
      lastSentAtRef.current = now;
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
          // The server refused it — normally a device clock that has run ahead of
          // the 3-2-1 window (the server will not accept a finish before its own
          // `startedAt`). Unlatch so the finisher can retry instead of being
          // stranded on a full passage the server never heard about.
          finishedRef.current = false;
        });
    }
  };

  if (!session) return null;

  const joined = joinedPlayers(session);
  const results = gameResults(session);
  const winner = results[0] || null;
  const iWon = Boolean(winner && winner.userId === viewerId);
  // Finishers first (by place), then anyone who never crossed the line — so the
  // runner-up still sees their own outcome instead of an empty result screen.
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

  // How the race was decided. A recorded margin only exists on a genuine photo
  // finish (both players finished); otherwise the runner-up's progress at the
  // moment the winner crossed is the honest answer to "how close was it?".
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

  return (
    <div className="fixed inset-0 z-50 flex h-[100dvh] flex-col overflow-hidden bg-[var(--bg-base)]">
      <style>{KEYFRAMES}</style>
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 pt-[max(env(safe-area-inset-top),0.75rem)] md:px-5 md:pt-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to arena"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/12 text-base">
          ⌨️
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-semibold leading-tight text-[var(--text-primary)]">
            Typing Race
          </h1>
          <p className="truncate text-[11px] leading-tight text-[var(--text-muted)]">
            {gameIsFinished(session)
              ? iWon
                ? "You won"
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
          <span className="shrink-0 font-mono text-[13px] tabular-nums text-[var(--text-muted)]">
            {formatClock(elapsedMs)}
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex w-full max-w-3xl flex-col px-4 py-5 md:px-6 md:py-8">
          {gameIsCancelled(session) ? (
            <p className="py-10 text-center text-sm text-[var(--text-muted)]">
              This race was cancelled.
            </p>
          ) : gameIsFinished(session) ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col items-center gap-1 py-6 text-center">
                {photoFinish && (
                  <span className="mb-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-600">
                    Photo finish
                  </span>
                )}
                <Trophy className="h-9 w-9 text-amber-500" />
                <p className="text-lg font-semibold text-[var(--text-primary)]">
                  {iWon
                    ? "You won \u{1F3C6}"
                    : `${winner?.displayName || "Someone"} won`}
                </p>
                <p className="text-[13px] text-[var(--text-muted)]">
                  {formatWpm(winner?.wpm)} · {formatAccuracy(winner?.accuracy)}{" "}
                  · {formatMs(winner?.elapsedMs)}
                </p>
                {closenessText && (
                  <p className="mt-1 text-[13px] font-semibold text-amber-600">
                    {closenessText}
                  </p>
                )}
              </div>
              {resultRows.map((p) => {
                const finished = p.place != null;
                return (
                  <div
                    key={p.userId}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                      p.userId === viewerId
                        ? "border-[var(--accent)]/40 bg-[var(--accent)]/5"
                        : "border-[var(--border)] bg-[var(--bg-surface)]"
                    }`}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[12px] font-semibold text-[var(--accent)]">
                      {finished ? p.place : "–"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[14px] text-[var(--text-primary)]">
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
              <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 md:p-5">
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
                {/* Decorative only: the disabled input's "Get ready…" placeholder
                    already tells assistive tech what is happening, and announcing
                    a number every second would just be noise. */}
                {countdownActive && (
                  <div
                    aria-hidden
                    className="absolute inset-0 flex flex-col items-center justify-center gap-1.5"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
                      Get ready
                    </span>
                    <span
                      key={countdownStep}
                      className="text-[64px] font-extrabold leading-none tabular-nums text-[var(--accent)] animate-[kivo-race-count-in_360ms_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none"
                    >
                      {countdownStep}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
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
                className="mt-4 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 font-mono text-[15px] text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] disabled:opacity-60"
              />

              <div className="mt-2 flex items-center justify-between text-[12px] tabular-nums text-[var(--text-muted)]">
                <span>Accuracy {Math.round(accuracy)}%</span>
                <span>{liveWpm} wpm</span>
              </div>
            </>
          )}

          {!gameIsFinished(session) && !gameIsCancelled(session) && (
            <div className="mt-6">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                Players
              </p>
              <div className="flex flex-col gap-2">
                {joined.map((p) => {
                  const isMe = p.userId === viewerId;
                  const pct =
                    isMe && active
                      ? Math.round(progress * 100)
                      : progressPercent(p);
                  // The endgame cue: anyone this close to the line turns their
                  // whole row tense, so a race never looks like two static bars.
                  const nearlyDone =
                    active &&
                    !countdownActive &&
                    pct >= RACE_DANGER_PCT &&
                    pct < 100;
                  return (
                    <div
                      key={p.userId}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
                        isMe ? "bg-[var(--accent)]/8" : ""
                      }`}
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[11px] font-semibold text-[var(--accent)]">
                        {initialsFor(p.displayName)}
                      </span>
                      <span className="w-28 shrink-0 truncate text-[13px] text-[var(--text-primary)]">
                        {p.displayName || "Player"}
                      </span>
                      <span className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                        <span
                          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
                            nearlyDone
                              ? "bg-amber-500 animate-[kivo-race-nearly_1s_ease-in-out_infinite] motion-reduce:animate-none"
                              : "bg-[var(--accent)]"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                      <span
                        className={`w-10 shrink-0 text-right text-[12px] tabular-nums ${
                          nearlyDone
                            ? "font-semibold text-amber-600"
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
        <div className="shrink-0 border-t border-[var(--border)] px-4 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 text-center text-[11px] text-[var(--text-muted)]">
          {iFinished || finishedRef.current ? (
            <span className="flex items-center justify-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Waiting for your
              opponent…
            </span>
          ) : countdownActive ? (
            "Go the instant the passage clears"
          ) : opponentNearlyDone ? (
            <span className="font-semibold text-amber-600">
              {opponent?.displayName || "Your opponent"} is nearly there — keep
              typing!
            </span>
          ) : (
            "Type the passage exactly — mistakes stall your progress"
          )}
        </div>
      )}
    </div>
  );
}

export default TypingRaceView;
