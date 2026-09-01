"use client";

import { Flag, Zap, Trophy, X, Check, Clock, Crown } from "lucide-react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useSocket } from "@/components/socket-provider";
import { apiGet } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { getCachedFinishedRace, setCachedFinishedRace } from "@/lib/cache";

function playerDisplayName(p, viewerId) {
  if (!p) return "Unknown";
  if (String(p.userId) === String(viewerId)) return "You";
  return p.displayName || p.username || "Player";
}

export function TypingRaceInviteCard({ message, currentUserId, onAccept, onDecline }) {
  const matchId = message.gameMatchId || message.matchId;
  const senderIsMe = message.senderId === currentUserId;
  const promptPreview = message.content?.replace("Typing race invited — ", "") || "Typing race";
  const socket = useSocket();
  const reduce = useReducedMotion();
  const viewerId = currentUserId || getSession()?.id;

  const [match, setMatch] = useState(null);
  const [loadingMatch, setLoadingMatch] = useState(Boolean(matchId));

  // fetch enriched match (with displayName) and listen for game:completed / game:update
  // Prefers IndexedDB for finished races — instant score recall without re-fetch
  useEffect(() => {
    if (!matchId) return;
    let active = true;
    (async () => {
      // try cache first for completed races
      try {
        const cached = await getCachedFinishedRace(matchId);
        if (cached && cached.status === "completed" && active) {
          setMatch(cached);
          setLoadingMatch(false);
          return;
        }
      } catch {}
      apiGet(`/api/v1/games/typing-race/${matchId}`)
        .then((m) => {
          if (active) {
            setMatch(m);
            if (m?.status === "completed") setCachedFinishedRace(matchId, m).catch(() => {});
          }
        })
        .catch(() => {})
        .finally(() => {
          if (active) setLoadingMatch(false);
        });
    })();
    return () => {
      active = false;
    };
  }, [matchId]);

  // realtime morph when race finishes — main socket carries game:completed from backend emitToConversation
  useEffect(() => {
    if (!socket || !matchId) return;
    const onCompleted = (data) => {
      if (String(data.matchId) !== String(matchId)) return;
      if (data.match) {
        setMatch(data.match);
        if (data.match.status === "completed") setCachedFinishedRace(matchId, data.match).catch(() => {});
      }
    };
    const onUpdate = (data) => {
      if (String(data.matchId) !== String(matchId)) return;
      if (data.match) {
        setMatch(data.match);
        if (data.match.status === "completed") setCachedFinishedRace(matchId, data.match).catch(() => {});
      }
    };
    // also listen for direct message edited? but game events suffice
    socket.on("game:completed", onCompleted);
    socket.on("game:update", onUpdate);
    // fallback: listen for any message layer that signals completion (if backend uses different name)
    socket.on("game:invite", onUpdate);
    return () => {
      socket.off("game:completed", onCompleted);
      socket.off("game:update", onUpdate);
      socket.off("game:invite", onUpdate);
    };
  }, [socket, matchId]);

  const isCompleted = match?.status === "completed";
  const playersSorted = isCompleted && Array.isArray(match?.players)
    ? [...match.players].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
    : [];
  const winner = isCompleted ? playersSorted[0] : null;
  const winnerName = winner ? playerDisplayName(winner, viewerId) : null;

  // smooth card transition
  return (
    <div className="my-2 flex justify-center px-2">
      <motion.div
        layout
        initial={reduce ? false : { opacity: 0, y: 8, scale: 0.98, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        transition={reduce ? { duration: 0 } : { duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[440px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm"
      >
        <AnimatePresence mode="wait" initial={false}>
          {isCompleted ? (
            <motion.div
              key="finished"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(4px)" }}
              transition={reduce ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* finished header */}
              <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-3.5 py-2.5">
                <span className="flex size-7 items-center justify-center rounded-full bg-amber-500 text-white">
                  <Trophy className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Race Finished</p>
                  <p className="truncate text-[11px] text-[var(--text-muted)]">
                    {winner ? `${winnerName} won • ${winner.wpm} WPM • ${winner.accuracy}%` : "All players have finished"}
                  </p>
                </div>
                <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[11px] font-semibold text-amber-500">Completed</span>
              </div>

              {/* winner highlight */}
              {winner && (
                <div className="bg-[var(--bg-base)] px-3.5 py-3">
                  <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
                      <Crown className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{winnerName}</p>
                      <p className="text-xs text-[var(--text-muted)]">{winner.wpm} WPM • {winner.accuracy}% accuracy</p>
                    </div>
                    <span className="text-sm font-bold text-amber-500">#1</span>
                  </div>
                </div>
              )}

              {/* full leaderboard */}
              <div className="px-3.5 pb-3">
                <div className="space-y-1.5">
                  {playersSorted.map((p) => {
                    const name = playerDisplayName(p, viewerId);
                    const isMe = String(p.userId) === String(viewerId);
                    return (
                      <div
                        key={String(p.userId)}
                        className={`flex items-center justify-between rounded-lg border px-2.5 py-2 ${
                          p.rank === 1
                            ? "border-amber-500/30 bg-amber-500/10"
                            : isMe
                              ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                              : "border-[var(--border)] bg-[var(--bg-elevated)]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                              p.rank === 1
                                ? "bg-amber-500 text-white"
                                : p.rank === 2
                                  ? "bg-zinc-400 text-white"
                                  : p.rank === 3
                                    ? "bg-amber-700 text-white"
                                    : "bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border)]"
                            }`}
                          >
                            {p.rank ?? "-"}
                          </span>
                          <span className="text-sm font-medium text-[var(--text-primary)]">{name}</span>
                        </div>
                        <span className="text-xs font-medium text-[var(--text-muted)]">
                          {p.wpm != null ? `${p.wpm} WPM` : "—"} • {p.accuracy != null ? `${p.accuracy}%` : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* finished — win/loss only, no action needed; scores are cached in IndexedDB */}
                <p className="mt-3 text-center text-[11px] text-[var(--text-muted)]">Scores saved locally — no re-fetch needed</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="invite"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={reduce ? { duration: 0 } : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* invite header */}
              <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-3.5 py-2.5">
                <span className="flex size-7 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)]">
                  <Zap className="h-3.5 w-3.5" />
                </span>
                <span className="flex-1 text-sm font-semibold text-[var(--text-primary)]">Typing Race</span>
                <span className="rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                  {senderIsMe ? "You invited" : "Invited you"}
                </span>
              </div>

              <div className="px-3.5 py-3">
                <p className="line-clamp-2 text-[13px] leading-snug text-[var(--text-muted)]">
                  <span className="font-medium text-[var(--text-primary)]">Prompt:</span> {promptPreview}
                </p>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                  <Clock className="h-3 w-3" />
                  <span>{match?.status === "active" ? "Race is live — join now" : "First to type accurately wins"}</span>
                </div>
                {loadingMatch && <p className="mt-2 text-xs text-[var(--text-muted)]">Loading race…</p>}
              </div>

              <div className="flex gap-2 border-t border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5">
                {senderIsMe ? (
                  <button
                    type="button"
                    onClick={() => onAccept?.(matchId, message)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-[var(--on-accent)] transition hover:brightness-110"
                  >
                    <Flag className="h-4 w-4" /> Join race
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onDecline?.(matchId)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-full border border-[var(--border)] bg-transparent px-3 py-2 text-[13px] font-medium text-[var(--text-muted)] transition hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
                    >
                      <X className="h-4 w-4" /> Decline
                    </button>
                    <button
                      type="button"
                      onClick={() => onAccept?.(matchId, message)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-2 text-[13px] font-semibold text-[var(--on-accent)] transition hover:brightness-110"
                    >
                      <Check className="h-4 w-4" /> Accept & Join
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

export default TypingRaceInviteCard;
