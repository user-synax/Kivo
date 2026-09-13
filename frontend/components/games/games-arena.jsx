"use client";

import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Send,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameResultFlash } from "@/components/games/game-result-flash";
import { TypingRaceView } from "@/components/games/typing-race-view";
import { useSocket } from "@/components/socket-provider";
import { apiGet, apiPost } from "@/lib/api";
import { getSession } from "@/lib/auth";
import {
  formatWpm,
  gameIsActive,
  gameKindMeta,
  gameResults,
  initialsFor,
  isHost,
  isInGame,
  playerFor,
} from "@/lib/games";

// Kivo Games — the full-screen arena at /games.
//
// Who is here: live arena presence over Socket.IO (people with this page open),
// plus your friends with an online dot. Pick someone and invite them; the
// backend resolves (or creates) your DM and drops a chip there, and the race
// itself is played right here.

function MemberRow({ name, username, subtitle, online, action }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5">
      <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/12 text-[12px] font-semibold text-[var(--accent)]">
        {initialsFor(name)}
        {online && (
          <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-[var(--bg-surface)] bg-emerald-500" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">
          {name || "Player"}
        </p>
        <p className="truncate text-[11px] text-[var(--text-muted)]">
          {subtitle || (username ? `@${username}` : "")}
        </p>
      </div>
      {action}
    </div>
  );
}

function InviteButton({ onClick, disabled, busy, label = "Invite" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[12px] font-medium text-[var(--on-accent,white)] transition-[filter] hover:brightness-110 disabled:opacity-40"
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Send className="h-3.5 w-3.5" />
      )}
      {label}
    </button>
  );
}

export function GamesArena() {
  const me = getSession();
  const myId = me?.id || null;
  const { socket, isConnected, reconnectNonce } = useSocket();

  const [roster, setRoster] = useState([]);
  const [onlineIds, setOnlineIds] = useState(() => new Set());
  const [friends, setFriends] = useState([]);
  const [invites, setInvites] = useState([]);
  const [myGames, setMyGames] = useState([]);
  const [race, setRace] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [resultFlash, setResultFlash] = useState(null); // { key, outcome, subtitle }
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [inv, mine] = await Promise.all([
        apiGet("/api/v1/games/invites"),
        apiGet("/api/v1/games/mine"),
      ]);
      setInvites(Array.isArray(inv) ? inv : []);
      setMyGames(Array.isArray(mine) ? mine : []);
    } catch {
      // Arena still works without the lists; the roster is socket-driven.
    } finally {
      setLoading(false);
    }
  }, []);

  const flash = useCallback((text) => {
    setNotice(text);
    setTimeout(() => setNotice(null), 2600);
  }, []);

  // Announce ourselves in the arena while this page is open. `reconnectNonce`
  // matters here: the socket instance survives a reconnect (the provider keeps
  // it), so without re-emitting on reconnect the server would still have removed
  // us on disconnect and we would silently vanish from the roster.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reconnectNonce is a deliberate re-trigger key, not a value read in the body.
  useEffect(() => {
    if (!socket) return undefined;
    socket.emit("arena:enter");
    return () => socket.emit("arena:leave");
  }, [socket, reconnectNonce]);

  // Track the open race id so a reconnect can re-sync it without stale closures.
  const raceIdRef = useRef(null);
  useEffect(() => {
    raceIdRef.current = race?.id || null;
  }, [race]);

  // Everything the socket delivered while we were disconnected is gone. On each
  // reconnect, re-pull the lists and re-fetch an open race so its status and the
  // opponent's progress are current again.
  useEffect(() => {
    if (!reconnectNonce) return;
    refresh();
    const id = raceIdRef.current;
    if (!id) return;
    apiGet(`/api/v1/games/${id}`)
      .then((session) =>
        setRace((prev) => (prev && prev.id === id ? session : prev)),
      )
      .catch(() => {});
  }, [reconnectNonce, refresh]);

  // Roster + presence + game events.
  useEffect(() => {
    if (!socket) return undefined;

    const onRoster = ({ members }) =>
      setRoster(Array.isArray(members) ? members : []);
    const onSnapshot = ({ online }) => {
      if (Array.isArray(online)) setOnlineIds(new Set(online.map(String)));
    };
    const onOnline = ({ userId }) =>
      setOnlineIds((prev) => new Set(prev).add(String(userId)));
    const onOffline = ({ userId }) =>
      setOnlineIds((prev) => {
        const next = new Set(prev);
        next.delete(String(userId));
        return next;
      });

    const applyGameEvent = (eventName, payload) => {
      if (!payload) return;
      const eventId = payload.id || payload.gameId || null;
      if (
        eventName === "game:started" &&
        payload.status === "active" &&
        isInGame(payload, myId)
      ) {
        // The race just began — drop straight into it. ONLY the start transition
        // opens this view, so later progress/finish traffic can never yank
        // someone back into a race they deliberately navigated away from.
        setRace(payload);
      } else if (eventId) {
        setRace((prev) => {
          if (!prev || prev.id !== eventId) return prev;
          if (!payload.id && Array.isArray(payload.players)) {
            // Progress traffic is partial by design: merge per player so fields
            // the event does not carry (status, displayName) are preserved.
            // Replacing the array wholesale wiped `status`, which made the race
            // look like it had ended and disabled the typing input mid-race.
            return {
              ...prev,
              players: prev.players.map((p) => {
                const update = payload.players.find(
                  (x) => x.userId === p.userId,
                );
                return update ? { ...p, ...update } : p;
              }),
            };
          }
          return payload;
        });
      }
      refresh();
    };

    const onGameEvent = (payload) => applyGameEvent(null, payload);
    const onGameStarted = (payload) => applyGameEvent("game:started", payload);

    // A finished race gets the big colour flash on top of the result screen.
    // Only players in the game see it — a bystander in the same chat gets the
    // result chip but no full-screen takeover.
    const onGameFinished = (payload) => {
      applyGameEvent("game:finished", payload);
      if (!payload || !isInGame(payload, myId)) return;
      const winner = gameResults(payload)[0] || null;
      const winnerId = payload.winnerId || winner?.userId || null;
      const iWon = Boolean(winnerId) && winnerId === myId;
      setResultFlash({
        key: Date.now(),
        outcome: iWon ? "win" : "lose",
        subtitle: iWon
          ? "You crossed the line first"
          : winner
            ? `${winner.displayName || "Your opponent"} · ${formatWpm(winner.wpm)}`
            : null,
      });
    };

    socket.on("arena:roster", onRoster);
    socket.on("presence:snapshot", onSnapshot);
    socket.on("presence:online", onOnline);
    socket.on("presence:offline", onOffline);
    socket.on("game:invited", onGameEvent);
    socket.on("game:updated", onGameEvent);
    socket.on("game:started", onGameStarted);
    socket.on("game:progress", onGameEvent);
    socket.on("game:finished", onGameFinished);
    socket.on("game:cancelled", onGameEvent);
    return () => {
      socket.off("arena:roster", onRoster);
      socket.off("presence:snapshot", onSnapshot);
      socket.off("presence:online", onOnline);
      socket.off("presence:offline", onOffline);
      socket.off("game:invited", onGameEvent);
      socket.off("game:updated", onGameEvent);
      socket.off("game:started", onGameStarted);
      socket.off("game:progress", onGameEvent);
      socket.off("game:finished", onGameFinished);
      socket.off("game:cancelled", onGameEvent);
    };
  }, [socket, myId, refresh]);

  // Friends list (ids that are already busy with a game are disabled below).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await apiGet("/api/v1/friends");
        if (active && Array.isArray(list)) setFriends(list);
      } catch {}
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Players I already have a live game with — inviting again would be rejected.
  const busyPlayerIds = useMemo(() => {
    const set = new Set();
    for (const g of myGames) {
      if (g.status !== "pending" && g.status !== "active") continue;
      for (const p of g.players || []) {
        if (p.userId !== myId) set.add(p.userId);
      }
    }
    return set;
  }, [myGames, myId]);

  const invite = async (targetUserId, name) => {
    if (!targetUserId || busyId) return;
    setBusyId(targetUserId);
    try {
      await apiPost("/api/v1/games/invite", { targetUserId, kind: "typing" });
      flash(`Invite sent to ${name || "player"}`);
      await refresh();
    } catch (e) {
      flash(e.message || "Could not send the invite");
    } finally {
      setBusyId(null);
    }
  };

  const accept = async (game) => {
    if (busyId) return;
    setBusyId(game.id);
    try {
      const session = await apiPost(`/api/v1/games/${game.id}/join`, {});
      if (gameIsActive(session)) setRace(session);
      await refresh();
    } catch (e) {
      flash(e.message || "Could not join the race");
    } finally {
      setBusyId(null);
    }
  };

  const decline = async (game) => {
    if (busyId) return;
    setBusyId(game.id);
    try {
      await apiPost(`/api/v1/games/${game.id}/decline`, {});
      await refresh();
    } catch (e) {
      flash(e.message || "Could not decline");
    } finally {
      setBusyId(null);
    }
  };

  const open = async (game) => {
    try {
      const session = await apiGet(`/api/v1/games/${game.id}`);
      setRace(session);
    } catch (e) {
      flash(e.message || "Could not open the race");
    }
  };

  const cancel = async (game) => {
    if (busyId) return;
    setBusyId(game.id);
    try {
      await apiPost(`/api/v1/games/${game.id}/cancel`, {});
      await refresh();
    } catch (e) {
      flash(e.message || "Could not cancel");
    } finally {
      setBusyId(null);
    }
  };

  // Mounted above whichever surface is showing so the flash also fires when the
  // player is back in the arena rather than watching the race.
  const resultFlashNode = resultFlash ? (
    <GameResultFlash
      key={resultFlash.key}
      outcome={resultFlash.outcome}
      subtitle={resultFlash.subtitle}
      onDone={() => setResultFlash(null)}
    />
  ) : null;

  if (race) {
    return (
      <>
        <TypingRaceView
          session={race}
          viewerId={myId}
          onClose={() => {
            setRace(null);
            refresh();
          }}
          onSession={(updated) => setRace(updated)}
        />
        {resultFlashNode}
      </>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--bg-base)]">
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 pt-[max(env(safe-area-inset-top),0.75rem)] md:px-5 md:pt-3">
        <Link
          href="/app"
          aria-label="Back to chats"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/12 text-base">
          🎮
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-semibold leading-tight text-[var(--text-primary)]">
            Kivo Games
          </h1>
          <p className="truncate text-[11px] leading-tight text-[var(--text-muted)]">
            {roster.length > 0
              ? `${roster.length} in the arena`
              : isConnected
                ? "Invite someone to a Typing Race"
                : "Connecting…"}
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          aria-label="Refresh"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 py-5 md:px-6 md:py-8">
          {/* Your games: invites first, then anything in flight. */}
          {(invites.length > 0 || myGames.length > 0) && (
            <section>
              <h2 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                <Swords className="h-3.5 w-3.5" /> Your games
              </h2>
              <div className="flex flex-col gap-2">
                {invites.map((game) => {
                  const host = (game.players || []).find(
                    (p) => p.userId !== myId,
                  );
                  const meta = gameKindMeta(game.kind);
                  return (
                    <div
                      key={game.id}
                      className="flex items-center gap-3 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/5 px-3 py-2.5"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/12 text-base">
                        {meta.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                          {host?.displayName || "Someone"} invited you
                        </p>
                        <p className="truncate text-[11px] text-[var(--text-muted)]">
                          {meta.label} · 1v1
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => accept(game)}
                          disabled={busyId === game.id}
                          className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[12px] font-medium text-[var(--on-accent,white)] transition-[filter] hover:brightness-110 disabled:opacity-50"
                        >
                          {busyId === game.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => decline(game)}
                          disabled={busyId === game.id}
                          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] disabled:opacity-50"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  );
                })}

                {myGames.map((game) => {
                  const opponent = (game.players || []).find(
                    (p) => p.userId !== myId,
                  );
                  const meta = gameKindMeta(game.kind);
                  const active = gameIsActive(game);
                  const awaiting =
                    !active && playerFor(game, myId)?.status === "joined";
                  const results = gameResults(game);
                  const winner = results[0] || null;
                  const label = active
                    ? "Live now"
                    : game.status === "finished"
                      ? winner
                        ? `${winner.displayName || "Winner"} won`
                        : "Finished"
                      : awaiting
                        ? `Waiting for ${opponent?.displayName || "opponent"}`
                        : game.status;

                  return (
                    <div
                      key={game.id}
                      className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/12 text-base">
                        {meta.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                          vs {opponent?.displayName || "Opponent"}
                        </p>
                        <p className="truncate text-[11px] text-[var(--text-muted)]">
                          {label}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => open(game)}
                          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12px] font-medium text-[var(--accent)] transition-colors hover:bg-[var(--hover)]"
                        >
                          {active ? "Join race" : "Open"}
                        </button>
                        {isHost(game, myId) && !active && (
                          <button
                            type="button"
                            onClick={() => cancel(game)}
                            disabled={busyId === game.id}
                            className="text-[11px] font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--destructive)] disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Who is here right now. */}
          <section>
            <h2 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
              <Users className="h-3.5 w-3.5" /> In the arena
              {roster.length > 0 && (
                <span className="ml-1 rounded-full bg-[var(--accent)]/12 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                  {roster.length}
                </span>
              )}
            </h2>
            {roster.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-7 text-center">
                <p className="text-[13px] text-[var(--text-muted)]">
                  No one else is in the arena right now.
                </p>
                <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                  Invite a friend below — the invite lands as a chip in your
                  chat.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {roster.map((m) => {
                  const id = m.userId || m.id;
                  return (
                    <MemberRow
                      key={id}
                      name={m.displayName}
                      username={m.username}
                      subtitle="In the games arena"
                      online
                      busy={busyId === id}
                      disabled={busyPlayerIds.has(id)}
                      action={
                        <InviteButton
                          onClick={() => invite(id, m.displayName)}
                          disabled={busyPlayerIds.has(id)}
                          busy={busyId === id}
                        />
                      }
                    />
                  );
                })}
              </div>
            )}
          </section>

          {/* Friends, online status from presence. */}
          <section>
            <h2 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
              <Trophy className="h-3.5 w-3.5" /> Friends
            </h2>
            {loading ? (
              <div className="flex items-center justify-center py-7">
                <Loader2 className="h-4 w-4 animate-spin text-[var(--text-muted)]" />
              </div>
            ) : friends.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-7 text-center">
                <p className="text-[13px] text-[var(--text-muted)]">
                  Add friends to play with them here.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {friends.map((f) => (
                  <MemberRow
                    key={f.id}
                    id={f.id}
                    name={f.displayName}
                    username={f.username}
                    online={onlineIds.has(String(f.id))}
                    subtitle={
                      onlineIds.has(String(f.id)) ? "Online" : "Offline"
                    }
                    busy={busyId === f.id}
                    disabled={busyPlayerIds.has(f.id)}
                    action={
                      <InviteButton
                        onClick={() => invite(f.id, f.displayName)}
                        disabled={busyPlayerIds.has(f.id)}
                        busy={busyId === f.id}
                      />
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {resultFlashNode}

      {notice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[max(env(safe-area-inset-bottom),1rem)] z-50 flex justify-center px-4">
          <div className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-[12px] text-[var(--text-primary)] shadow-lg">
            {notice}
          </div>
        </div>
      )}
    </div>
  );
}

export default GamesArena;
