"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Gamepad2, Zap, Trophy, Clock, Users, Swords, Crown, ChevronRight, MessageCircle, Layers, Sparkles } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { otherParticipant, participantName } from "@/lib/chat";
import { Avatar } from "@/components/dashboard/avatar";
import { TypingRaceRoom } from "@/components/games/typing-race-room";
import { setCachedFinishedRace } from "@/lib/cache";

const EASE = [0.22, 1, 0.36, 1];

function useCurrentUser() {
  const [user] = useState(() => getSession());
  return user;
}

export function MiniGamesHub() {
  const reduce = useReducedMotion();
  const currentUser = useCurrentUser();
  const userId = currentUser?.id;

  const [conversations, setConversations] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [selectedConv, setSelectedConv] = useState(null);
  const [activeRace, setActiveRace] = useState(null); // {matchId, prompt}

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      apiGet("/api/v1/conversations").catch(() => []),
      apiGet("/api/v1/games/typing-race?limit=20").catch(() => []),
    ])
      .then(([convData, matchData]) => {
        if (!active) return;
        const convs = Array.isArray(convData) ? convData : [];
        // only DM & group for racing (filter space_channel differently but allow)
        setConversations(convs);
        const ms = Array.isArray(matchData) ? matchData : matchData?.matches || [];
        setMatches(ms);
        // cache only finished races for instant score recall without re-fetch
        ms.forEach((m) => {
          if (m?.status === "completed" && m?.id) setCachedFinishedRace(m.id, m).catch(() => {});
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleInvite = async () => {
    if (!selectedConv) return;
    setInviteBusy(true);
    try {
      const res = await apiPost("/api/v1/games/typing-race/invite", { conversationId: selectedConv });
      const match = res?.match;
      setInviteOpen(false);
      setSelectedConv(null);
      if (match?.id) {
        setActiveRace({ matchId: match.id, prompt: match.textPrompt });
        // refresh recent
        apiGet("/api/v1/games/typing-race?limit=20")
          .then((d) => setMatches(Array.isArray(d) ? d : []))
          .catch(() => {});
      }
    } catch (err) {
      window.alert(err?.message || "Could not invite");
    } finally {
      setInviteBusy(false);
    }
  };

  const handleJoinFromHub = (m) => {
    if (!m?.id) return;
    setActiveRace({ matchId: m.id, prompt: m.textPrompt });
  };

  return (
    <div className="min-h-full bg-[var(--bg-base)]">
      {/* hero */}
      <div className="relative overflow-hidden border-b border-[var(--border)]">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[var(--bg-elevated)]" />
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
          <div className="absolute -top-24 right-0 h-[280px] w-[420px] rounded-full bg-[var(--accent)] opacity-[0.08] blur-[80px]" />
        </div>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={reduce ? { duration: 0 } : { duration: 0.5, ease: EASE }}
          className="relative mx-auto max-w-[1200px] px-4 py-10 sm:px-6 sm:py-12 lg:px-8"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[640px]">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/20 bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-[var(--accent)]">
                <Gamepad2 className="h-3.5 w-3.5" /> Mini-Games • v1
              </span>
              <h1 className="framer-display-md mt-3 text-[var(--text-primary)] sm:framer-display-lg">Play together, right inside chat.</h1>
              <p className="mt-3 max-w-[560px] text-[15px] leading-relaxed text-[var(--text-muted)]">
                Challenge friends to a real-time typing race. Invite from here — your friend gets the invite in DM with a notification, just like before.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <a
                href="/app"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--hover)]"
              >
                <MessageCircle className="h-4 w-4" /> Back to Chats
              </a>
            </div>
          </div>
        </motion.div>
      </div>

      {/* content */}
      <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
        {/* featured typing race */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={reduce ? { duration: 0 } : { duration: 0.44, ease: EASE, delay: 0.06 }}
          className="grid gap-6 lg:grid-cols-[1.35fr_0.85fr]"
        >
          {/* spotlight card */}
          <div className="spotlight spotlight-violet p-6 sm:p-7">
            <div className="flex flex-col gap-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur">
                    <Zap className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">Typing Race</p>
                    <p className="text-xs text-white/70">2+ players • 60s • Real-time</p>
                  </div>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#5a3df0]">Live</span>
              </div>

              <div>
                <h2 className="font-display text-2xl font-medium tracking-tight text-white sm:text-[28px]">How fast can you type?</h2>
                <p className="mt-2 text-sm leading-relaxed text-white/80">A short prompt, a 3-2-1 countdown, live progress bars for every opponent, and WPM + accuracy at the finish.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setInviteOpen(true)}
                  className="kivo-cta inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
                >
                  <Swords className="h-4 w-4" /> Challenge Friend
                </button>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-xs font-medium text-white/80">
                  <Users className="h-3.5 w-3.5" /> DM or Group
                </span>
              </div>

              <div className="flex items-center gap-2 border-t border-white/10 pt-4 text-xs text-white/60">
                <Sparkles className="h-3.5 w-3.5" /> Invite appears inline in chat • Accept to join the /games room
              </div>
            </div>
          </div>

          {/* coming soon grid */}
          <div className="grid gap-3">
            {[
              { title: "Chess", desc: "1v1 • classic", icon: Crown, soon: true },
              { title: "Ludo", desc: "2-4 players • board", icon: Layers, soon: true },
              { title: "Cards", desc: "2+ • quick rounds", icon: Trophy, soon: true },
            ].map((g, i) => {
              const Icon = g.icon;
              return (
                <motion.div
                  key={g.title}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.36, ease: EASE, delay: 0.08 + i * 0.06 }}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 opacity-80"
                >
                  <span className="flex size-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-muted)]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{g.title}</p>
                    <p className="text-xs text-[var(--text-muted)]">{g.desc}</p>
                  </div>
                  <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">Soon</span>
                </motion.div>
              );
            })}
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-transparent p-4 text-center">
              <p className="text-xs text-[var(--text-muted)]">More games ship next — architecture is ready, no extra infra.</p>
            </div>
          </div>
        </motion.div>

        {/* recent races */}
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <Clock className="h-4 w-4 text-[var(--text-muted)]" /> Recent races
            </h3>
            <span className="text-xs text-[var(--text-muted)]">{matches.length} total</span>
          </div>

          {loading ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((k) => (
                <div key={k} className="h-[118px] animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]" />
              ))}
            </div>
          ) : matches.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-8 text-center">
              <p className="text-sm font-medium text-[var(--text-primary)]">No races yet</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Invite a friend to start your first Typing Race — it will appear here and in DM.</p>
            </div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {matches.map((m, idx) => {
                const isCompleted = m.status === "completed";
                const pending = m.status === "pending";
                const sorted = Array.isArray(m.players) ? [...m.players].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)) : [];
                const winner = isCompleted && sorted.length ? sorted[0] : null;
                const winnerName = winner ? winner.displayName || winner.username || "—" : null;
                return (
                  <motion.div
                    key={m.id}
                    initial={reduce ? false : { opacity: 0, y: 8, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={reduce ? { duration: 0 } : { duration: 0.32, ease: EASE, delay: Math.min(idx, 6) * 0.04 }}
                    className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 transition hover:border-[var(--border)] hover:bg-[var(--bg-elevated)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${isCompleted ? "bg-amber-500/15 text-amber-500" : pending ? "bg-[var(--accent-soft)] text-[var(--text-primary)]" : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border)]"}`}>
                        {isCompleted ? <Trophy className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
                        {isCompleted ? "Finished" : pending ? "Pending" : "Active"}
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)]">{m.players?.length || 2} players</span>
                    </div>

                    <p className="mt-3 line-clamp-2 text-sm font-medium text-[var(--text-primary)]">{m.textPrompt}</p>

                    {isCompleted && sorted.length ? (
                      <div className="mt-3 space-y-1.5">
                        {sorted.map((p) => {
                          const name = p.displayName || p.username || "—";
                          const isWinner = p.rank === 1;
                          return (
                            <div
                              key={String(p.userId)}
                              className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 ${isWinner ? "border-amber-500/30 bg-amber-500/10" : "border-[var(--border)] bg-[var(--bg-elevated)]"}`}
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <span className={`flex size-5 items-center justify-center rounded-full text-[11px] font-bold ${isWinner ? "bg-amber-500 text-white" : p.rank === 2 ? "bg-zinc-400 text-white" : p.rank === 3 ? "bg-amber-700 text-white" : "bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border)]"}`}>
                                  {p.rank ?? "-"}
                                </span>
                                <span className="truncate text-xs font-medium text-[var(--text-primary)]">{name}</span>
                                {isWinner && <Crown className="h-3 w-3 shrink-0 text-amber-500" />}
                              </div>
                              <span className="shrink-0 text-xs font-medium text-[var(--text-muted)]">{p.wpm ?? "-"} WPM • {p.accuracy ?? "-"}%</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-[var(--text-muted)]">{pending ? "Waiting for players to join /games" : "Race in progress…"}</p>
                    )}

                    {!isCompleted && (
                      <button
                        type="button"
                        onClick={() => handleJoinFromHub(m)}
                        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--hover)]"
                      >
                        Join race <ChevronRight className="h-4 w-4" />
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* invite drawer */}
      <AnimatePresence>
        {inviteOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={reduce ? { duration: 0 } : { duration: 0.2 }}
              onClick={() => setInviteOpen(false)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              key="panel"
              initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 12, scale: 0.98, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98, filter: "blur(4px)" }}
              transition={reduce ? { duration: 0 } : { duration: 0.28, ease: EASE }}
              className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[72vh] w-full max-w-[720px] overflow-hidden rounded-t-2xl border-x border-t border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl sm:inset-0 sm:m-auto sm:max-h-[560px] sm:rounded-2xl sm:border"
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 sm:px-5">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Challenge a friend</p>
                  <p className="text-xs text-[var(--text-muted)]">Invite posts to DM • They’ll get a notification</p>
                </div>
                <button type="button" onClick={() => setInviteOpen(false)} className="flex size-8 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover)]">
                  ✕
                </button>
              </div>

              <div className="flex max-h-[48vh] flex-col overflow-hidden sm:max-h-[420px]">
                <div className="flex-1 overflow-y-auto p-2">
                  {conversations.length === 0 ? (
                    <div className="p-8 text-center text-sm text-[var(--text-muted)]">No conversations yet — start a DM first.</div>
                  ) : (
                    <div className="space-y-1">
                      {conversations.map((c) => {
                        const isGroup = c.type === "group";
                        const other = !isGroup ? otherParticipant(c, userId) : null;
                        const name = isGroup ? c.name || "Group" : participantName(other) || "DM";
                        const selected = selectedConv === c.id;
                        const avatarName = name;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setSelectedConv(c.id)}
                            className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${selected ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-transparent hover:bg-[var(--hover)]"}`}
                          >
                            <Avatar name={avatarName} size="sm" avatarStyle={isGroup ? null : other?.avatarStyle} url={isGroup ? c.avatarUrl : other?.avatarUrl} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-[var(--text-primary)]">{name}</p>
                              <p className="truncate text-xs text-[var(--text-muted)]">
                                {isGroup ? `${c.participants?.length || 0} members` : other?.username ? `@${other.username}` : c.type}
                              </p>
                            </div>
                            {selected && <span className="size-2 rounded-full bg-[var(--accent)]" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="border-t border-[var(--border)] bg-[var(--bg-surface)] p-3 sm:p-4">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setInviteOpen(false)} className="flex-1 rounded-full border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--hover)]">
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!selectedConv || inviteBusy}
                      onClick={handleInvite}
                      className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--on-accent)] hover:brightness-110 disabled:opacity-40"
                    >
                      {inviteBusy ? "Inviting…" : "Invite to Race"} <Zap className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* active race overlay — hub can also host the race without going to DM */}
      <AnimatePresence>
        {activeRace && (
          <motion.div
            key="race"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.2 }}
            className="fixed inset-0 z-[60]"
          >
            <TypingRaceRoom
              matchId={activeRace.matchId}
              initialPrompt={activeRace.prompt}
              onClose={() => {
                setActiveRace(null);
                // refresh matches after close (to show finished state)
                apiGet("/api/v1/games/typing-race?limit=20")
                  .then((d) => {
                    const arr = Array.isArray(d) ? d : [];
                    setMatches(arr);
                    arr.forEach((m) => {
                      if (m?.status === "completed" && m?.id) setCachedFinishedRace(m.id, m).catch(() => {});
                    });
                  })
                  .catch(() => {});
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default MiniGamesHub;
