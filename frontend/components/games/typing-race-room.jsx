"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Flag, Trophy, Clock, Target, X, Zap } from "lucide-react";
import { connectGamesSocket } from "@/lib/games-socket";
import { getSession } from "@/lib/auth";
import { getCachedFinishedRace, setCachedFinishedRace } from "@/lib/cache";

function calculateWPM(charsTyped, elapsedMs) {
  if (elapsedMs <= 0) return 0;
  const minutes = elapsedMs / 60000;
  const words = charsTyped / 5;
  return Math.round(words / minutes);
}

function calculateAccuracy(prompt, typed) {
  if (!typed.length) return 100;
  let correct = 0;
  for (let i = 0; i < typed.length; i++) {
    if (typed[i] === prompt[i]) correct++;
  }
  return Math.round((correct / typed.length) * 100);
}

export function TypingRaceRoom({ matchId, initialPrompt, onClose, participants }) {
  const currentUser = getSession();
  const userId = currentUser?.id;

  const [prompt, setPrompt] = useState(initialPrompt || "");
  const [countdown, setCountdown] = useState(null); // 3,2,1,null
  const [status, setStatus] = useState("waiting"); // waiting | countdown | racing | finished | completed
  const [typed, setTyped] = useState("");
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [othersProgress, setOthersProgress] = useState({}); // userId -> charsTyped
  const [results, setResults] = useState([]); // finished players
  const [myResult, setMyResult] = useState(null);
  const [joinedCount, setJoinedCount] = useState(1);
  const [expectedCount, setExpectedCount] = useState(2);
  const [namesMap, setNamesMap] = useState({}); // userId -> displayName

  // preload enriched match to get full names for all players
  useEffect(() => {
    if (!matchId) return;
    let active = true;
    import("@/lib/api").then(({ apiGet }) => {
      apiGet(`/api/v1/games/typing-race/${matchId}`)
        .then((m) => {
          if (!active || !m?.players) return;
          const map = {};
          for (const p of m.players) {
            const id = String(p.userId);
            map[id] = p.displayName || p.username || (id === String(userId) ? "You" : "Player");
          }
          setNamesMap(map);
          if (!initialPrompt && m.textPrompt) setPrompt(m.textPrompt);
        })
        .catch(() => {});
    });
    // also try to enrich from passed participants prop (conversation members)
    if (Array.isArray(participants) && participants.length) {
      const map = {};
      for (const p of participants) {
        const id = String(p.id || p._id || p);
        map[id] = p.displayName || p.username || map[id];
      }
      setNamesMap((prev) => ({ ...map, ...prev }));
    }
    return () => {
      active = false;
    };
  }, [matchId, initialPrompt, participants, userId]);

  const inputRef = useRef(null);
  const socketRef = useRef(null);
  const throttledRef = useRef(0);
  const finishedRef = useRef(false);

  // Connect to /games and join
  useEffect(() => {
    let active = true;
    let s = null;

    (async () => {
      try {
        s = await connectGamesSocket();
        if (!active) return;
        socketRef.current = s;

        const onJoined = (data) => {
          if (String(data.matchId) !== String(matchId)) return;
          setJoinedCount(data.joinedCount);
          setExpectedCount(data.expectedCount);
        };

        const onWaiting = (data) => {
          if (String(data.matchId) !== String(matchId)) return;
          if (data.textPrompt) setPrompt(data.textPrompt);
          setJoinedCount(data.joinedCount ?? 1);
          setExpectedCount(data.expectedCount ?? 2);
          setStatus("waiting");
        };

        const onStart = (data) => {
          if (String(data.matchId) !== String(matchId)) return;
          const p = data.textPrompt || data.prompt;
          if (p) setPrompt(p);
          // countdown 3-2-1
          if (data.countdown > 0) {
            setStatus("countdown");
            let c = data.countdown;
            setCountdown(c);
            const iv = setInterval(() => {
              c -= 1;
              if (c > 0) setCountdown(c);
              else {
                clearInterval(iv);
                setCountdown(null);
                setStatus("racing");
                setStartTime(Date.now());
                setTimeout(() => inputRef.current?.focus(), 50);
              }
            }, 900);
          } else {
            setStatus("racing");
            setStartTime(Date.now());
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        };

        const onProgress = (data) => {
          if (String(data.matchId) !== String(matchId)) return;
          if (String(data.userId) === String(userId)) return;
          setOthersProgress((prev) => ({ ...prev, [String(data.userId)]: data.charsTyped }));
        };

        const onFinished = (data) => {
          if (String(data.matchId) !== String(matchId)) return;
          // keep namesMap enriched if payload carries displayName
          if (data.displayName || data.username) {
            setNamesMap((prev) => ({ ...prev, [String(data.userId)]: data.displayName || data.username }));
          }
          setResults((prev) => {
            if (prev.some((r) => String(r.userId) === String(data.userId))) return prev;
            return [...prev, data].sort((a, b) => a.rank - b.rank);
          });
        };

        const onCompleted = (data) => {
          if (String(data.matchId) !== String(matchId)) return;
          setStatus("completed");
          if (Array.isArray(data.results)) {
            // enrich namesMap from completed payload
            const mapPatch = {};
            for (const r of data.results) {
              if (r.displayName || r.username) mapPatch[String(r.userId)] = r.displayName || r.username;
            }
            if (Object.keys(mapPatch).length) setNamesMap((prev) => ({ ...prev, ...mapPatch }));
            const sorted = [...data.results].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
            setResults(sorted);
          }
        };

        s.on("race:joined", onJoined);
        s.on("race:waiting", onWaiting);
        s.on("race:start", onStart);
        s.on("race:progress", onProgress);
        s.on("race:finished", onFinished);
        s.on("race:completed", onCompleted);

        // emit join
        s.emit("race:join", { matchId: String(matchId) });

        // cleanup
        s._kivo_cleanup = () => {
          s.off("race:joined", onJoined);
          s.off("race:waiting", onWaiting);
          s.off("race:start", onStart);
          s.off("race:progress", onProgress);
          s.off("race:finished", onFinished);
          s.off("race:completed", onCompleted);
        };
      } catch (err) {
        console.error("[TypingRaceRoom] connect failed", err);
      }
    })();

    return () => {
      active = false;
      if (s && s._kivo_cleanup) s._kivo_cleanup();
      // leave room
      try {
        s?.emit("race:leave", { matchId: String(matchId) });
      } catch {}
    };
  }, [matchId, userId]);

  // elapsed timer
  useEffect(() => {
    if (status !== "racing" || !startTime) return;
    const iv = setInterval(() => setElapsed(Date.now() - startTime), 200);
    return () => clearInterval(iv);
  }, [status, startTime]);

  // throttled progress emission: every 300ms or word boundary
  const emitProgress = useCallback(
    (chars) => {
      const s = socketRef.current;
      if (!s || status !== "racing") return;
      const now = Date.now();
      const isWordBoundary = chars > 0 && prompt[chars - 1] === " ";
      if (now - throttledRef.current >= 300 || isWordBoundary) {
        throttledRef.current = now;
        s.emit("race:progress", { matchId: String(matchId), charsTyped: chars });
      }
    },
    [matchId, status, prompt]
  );

  const handleChange = (e) => {
    if (status !== "racing") return;
    const val = e.target.value;
    // allow only up to prompt length + allow typing beyond? clamp
    const clamped = val.slice(0, prompt.length);
    setTyped(clamped);
    emitProgress(clamped.length);

    if (!finishedRef.current && clamped.length >= prompt.length) {
      // check if fully correct? We still finish even if some chars wrong — but require full length
      finishedRef.current = true;
      const elapsedMs = Date.now() - (startTime || Date.now());
      const wpm = calculateWPM(prompt.length, elapsedMs);
      const accuracy = calculateAccuracy(prompt, clamped);
      const payload = { matchId: String(matchId), wpm, accuracy };
      setMyResult({ wpm, accuracy, rank: null, elapsedMs });
      setStatus("finished");
      socketRef.current?.emit("race:finish", payload);
    }
  };

  // derived progress
  const myPct = prompt.length ? Math.min(typed.length / prompt.length, 1) : 0;
  const wpmLive = status === "racing" && startTime ? calculateWPM(typed.length, Date.now() - startTime) : myResult?.wpm ?? 0;

  // render prompt with per-character highlighting
  const renderPrompt = () => {
    if (!prompt) return null;
    return (
      <div className="select-none font-mono text-[15px] leading-7 tracking-tight">
        {prompt.split("").map((ch, i) => {
          let cls = "text-[var(--text-muted)]";
          if (i < typed.length) {
            cls = typed[i] === ch ? "text-[var(--text-primary)] bg-[var(--accent-soft)]" : "text-red-400 bg-red-500/10";
          }
          if (i === typed.length) cls += " border-l-2 border-[var(--accent)] animate-pulse";
          return (
            <span key={i} className={cls}>
              {ch}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[86vh] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)]">
              <Zap className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Typing Race</p>
              <p className="text-[11px] text-[var(--text-muted)]">
                {status === "waiting" && `Waiting for players ${joinedCount}/${expectedCount}`}
                {status === "countdown" && "Get ready…"}
                {status === "racing" && `${Math.floor(elapsed / 1000)}s • ${wpmLive} WPM`}
                {status === "finished" && "Waiting for results…"}
                {status === "completed" && "Race completed"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close race"
            className="flex size-8 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* countdown */}
        {status === "countdown" && countdown !== null && (
          <div className="flex flex-col items-center justify-center gap-3 bg-[var(--bg-base)] px-6 py-10">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Starting in</span>
            <span key={countdown} className="t-text-swap font-display text-6xl font-semibold text-[var(--text-primary)]">
              {countdown}
            </span>
            <p className="max-w-md text-center text-sm text-[var(--text-muted)]">{prompt}</p>
          </div>
        )}

        {status === "waiting" && (
          <div className="flex flex-col items-center justify-center gap-4 bg-[var(--bg-base)] px-6 py-12">
            <div className="flex size-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)]">
              <Clock className="h-6 w-6 text-[var(--text-muted)]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[var(--text-primary)]">Waiting for opponents to join</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {joinedCount} of {expectedCount} players joined — race starts when everyone joins
              </p>
            </div>
            <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3">
              <p className="text-xs font-medium text-[var(--text-muted)]">Prompt preview</p>
              <p className="mt-1 text-sm text-[var(--text-primary)]">{prompt}</p>
            </div>
          </div>
        )}

        {(status === "racing" || status === "finished") && (
          <div className="flex flex-1 flex-col gap-4 overflow-auto bg-[var(--bg-base)] p-5">
            {/* progress bars */}
            <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-muted)]">
                <Target className="h-3.5 w-3.5" /> Progress
              </div>
              {/* you */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[var(--text-primary)]">You</span>
                  <span className="text-[var(--text-muted)]">{Math.round(myPct * 100)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                  <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-150" style={{ width: `${myPct * 100}%` }} />
                </div>
              </div>
              {/* others */}
              {Object.entries(othersProgress).map(([uid, chars]) => {
                const pct = prompt.length ? Math.min(chars / prompt.length, 1) : 0;
                const name = namesMap[String(uid)] || "Opponent";
                return (
                  <div key={uid} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate font-medium text-[var(--text-muted)]">{name}</span>
                      <span className="shrink-0 text-[var(--text-muted)]">{Math.round(pct * 100)}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                      <div
                        className="h-full rounded-full bg-[var(--text-muted)] transition-all duration-300"
                        style={{ width: `${pct * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {Object.keys(othersProgress).length === 0 && status === "racing" && (
                <p className="text-xs text-[var(--text-muted)]">Waiting for opponents…</p>
              )}
            </div>

            {/* prompt display */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">{renderPrompt()}</div>

            {/* typing input */}
            <textarea
              ref={inputRef}
              value={typed}
              onChange={handleChange}
              disabled={status !== "racing"}
              placeholder={status === "racing" ? "Start typing…" : "Waiting…"}
              className="min-h-[96px] w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 font-mono text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none disabled:opacity-60"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />

            {status === "finished" && myResult && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-center">
                <p className="text-sm font-semibold text-[var(--text-primary)]">You finished!</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {myResult.wpm} WPM • {myResult.accuracy}% accuracy — waiting for final ranks
                </p>
              </div>
            )}
          </div>
        )}

        {status === "completed" && (
          <div className="flex flex-col gap-4 bg-[var(--bg-base)] p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <Trophy className="h-4 w-4 text-amber-500" /> Results
            </div>
            <div className="space-y-2">
              {results
                .slice()
                .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
                .map((r, idx) => {
                  const isMe = String(r.userId) === String(userId);
                  const display = r.displayName || r.username || namesMap[String(r.userId)] || (isMe ? "You" : "Player");
                  const label = isMe ? `${display} (You)` : display;
                  return (
                    <div
                      key={String(r.userId) + idx}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${
                        isMe ? "border-[var(--accent)] bg-[var(--accent-soft)]" : r.rank === 1 ? "border-amber-500/30 bg-amber-500/10" : "border-[var(--border)] bg-[var(--bg-surface)]"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            r.rank === 1 ? "bg-amber-500 text-white" : r.rank === 2 ? "bg-zinc-400 text-white" : r.rank === 3 ? "bg-amber-700 text-white" : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border)]"
                          }`}
                        >
                          {r.rank ?? idx + 1}
                        </span>
                        <span className="truncate text-sm font-medium text-[var(--text-primary)]">{label}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-xs">
                        <span className="font-medium text-[var(--text-primary)]">{r.wpm ?? "-"} WPM</span>
                        <span className="text-[var(--text-muted)]">{r.accuracy ?? "-"}% acc</span>
                      </div>
                    </div>
                  );
                })}
            </div>
            {myResult && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 text-center text-xs text-[var(--text-muted)]">
                Your performance: <span className="font-semibold text-[var(--text-primary)]">{myResult.wpm} WPM</span> • {myResult.accuracy}% accuracy
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--on-accent)] hover:brightness-110"
            >
              Close
            </button>
          </div>
        )}

        {/* footer when racing */}
        {status === "racing" && (
          <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-1.5">
              <Flag className="h-3.5 w-3.5" /> Type the prompt exactly
            </span>
            <span>{typed.length}/{prompt.length} chars</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default TypingRaceRoom;
