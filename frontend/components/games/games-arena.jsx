"use client";

import {
  ArrowLeft,
  Bot,
  Flame,
  Gamepad2,
  Gauge,
  Keyboard,
  Loader2,
  Music,
  RefreshCw,
  Send,
  Swords,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameResultFlash } from "@/components/games/game-result-flash";
import { TypingRaceView } from "@/components/games/typing-race-view";
import { useSocket } from "@/components/socket-provider";
import { apiGet, apiPost } from "@/lib/api";
import { getSession } from "@/lib/auth";
import {
  consumeArenaEntry,
  formatBoardReset,
  formatWpm,
  gameIsActive,
  gameKindMeta,
  gameResults,
  initialsFor,
  isHost,
  isInGame,
  PRACTICE_DIFFICULTIES,
  playerFor,
} from "@/lib/games";
import {
  getSoundPrefs,
  playArenaEnter,
  playClick,
  playInvite,
  playJoin,
  setSoundPrefs,
  startArenaMusic,
  stopArenaMusic,
} from "@/lib/sound";

// Kivo Arena — full-screen game lobby at /games.
// Flat monochrome surfaces only: no gradients, no spotlight washes, no emojis —
// lucide icons only. Pill CTAs, staggered card entrances.
// All taps click, invites lift, joins rise; background synth loop while here.
// NOTE: gradient "slop" is banned in this app — do not reintroduce
// bg-gradient-*, spotlight-*, or violet/magenta washes here.

// Welcome-gate timing: long enough to read the name, short enough to never
// feel like a loader. Tap skips it instantly.
export const ARENA_ENTRY_MS = 1500;
const ARENA_ENTRY_REDUCED_MS = 500;

const ARENA_KEYFRAMES = `@keyframes kivo-arena-pulse {
  0%,100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.45; transform: scale(0.82); }
}
@keyframes kivo-arena-gate-in {
  0% { opacity: 0; transform: scale(0.92) translateY(10px); filter: blur(4px); }
  100% { opacity: 1; transform: none; filter: none; }
}
@keyframes kivo-arena-gate-wash {
  0% { opacity: 0; }
  8% { opacity: 1; }
  78% { opacity: 1; }
  100% { opacity: 0; }
}`;

function StatusPill({ tone, children, live }) {
  const styles =
    tone === "live"
      ? "bg-emerald-500/15 text-emerald-500"
      : tone === "invite"
        ? "bg-[var(--accent)]/15 text-[var(--accent)]"
        : tone === "waiting"
          ? "bg-amber-500/15 text-amber-600"
          : "bg-[var(--bg-elevated)] text-[var(--text-muted)]";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${styles}`}
    >
      {live && (
        <span className="size-1.5 rounded-full bg-current animate-[kivo-arena-pulse_1.4s_ease-in-out_infinite] motion-reduce:animate-none" />
      )}
      {children}
    </span>
  );
}

function PlayerCard({
  name,
  username,
  online,
  statusLine,
  action,
  index = 0,
  featured,
}) {
  return (
    <div
      className={`t-item-in group flex items-center gap-3 rounded-2xl border p-3 transition-colors ${
        featured
          ? "border-[var(--accent)]/35 bg-[var(--accent)]/[0.06]"
          : "border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--text-muted)]/40"
      }`}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/12 text-[13px] font-bold text-[var(--accent)]">
        {initialsFor(name)}
        <span
          className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-[var(--bg-surface)] ${
            online ? "bg-emerald-500" : "bg-[var(--text-muted)]/40"
          }`}
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold text-[var(--text-primary)]">
          {name || "Player"}
        </p>
        <p className="truncate text-[11px] text-[var(--text-muted)]">
          {statusLine || (username ? `@${username}` : "")}
        </p>
      </div>
      {action}
    </div>
  );
}

function ArenaButton({
  onClick,
  disabled,
  busy,
  children,
  variant = "primary",
  label,
}) {
  const base =
    "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none min-h-[36px]";
  const styles =
    variant === "primary"
      ? "bg-white text-black hover:brightness-90 shadow-[0_8px_24px_-8px_rgba(255,255,255,0.4)]"
      : variant === "ghost"
        ? "border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
        : "bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:brightness-125 border border-[var(--border)]";
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        playClick();
        onClick?.();
      }}
      disabled={disabled || busy}
      className={`${base} ${styles}`}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : children}
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
  const [resultFlash, setResultFlash] = useState(null);
  const [loading, setLoading] = useState(true);
  // Welcome gate: true only when we arrived via the icon rail / menu (one-shot
  // sessionStorage flag). Direct visits and reloads skip it.
  const [showEntry, setShowEntry] = useState(() => {
    try {
      return consumeArenaEntry();
    } catch {
      return false;
    }
  });
  const [musicOn, setMusicOn] = useState(() => {
    try {
      return getSoundPrefs().arenaMusic !== false;
    } catch {
      return true;
    }
  });
  const [sfxOn, setSfxOn] = useState(() => {
    try {
      return getSoundPrefs().gameResults !== false;
    } catch {
      return true;
    }
  });

  const [board, setBoard] = useState(null);

  // Weekly board + my progression. Refreshed with the lists, on every race
  // finish (socket), and on a slow poll so rival finishes land live.
  const refreshBoard = useCallback(async () => {
    try {
      const data = await apiGet("/api/v1/games/leaderboard");
      if (data && Array.isArray(data.entries)) setBoard(data);
    } catch {
      // Board is progressive enhancement; the lobby works without it.
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [inv, mine] = await Promise.all([
        apiGet("/api/v1/games/invites"),
        apiGet("/api/v1/games/mine"),
      ]);
      setInvites(Array.isArray(inv) ? inv : []);
      setMyGames(Array.isArray(mine) ? mine : []);
    } catch {
      // Roster is socket-driven; lists are progressive enhancement.
    } finally {
      setLoading(false);
    }
    refreshBoard();
  }, [refreshBoard]);

  const flash = useCallback((text) => {
    setNotice(text);
    setTimeout(() => setNotice(null), 2600);
  }, []);

  // Welcome gate: chime + auto-dismiss. Reduced-motion shortens the hold and
  // drops the pop animation (see motion-reduce classes on the overlay).
  useEffect(() => {
    if (!showEntry) return undefined;
    try {
      playArenaEnter();
    } catch {}
    let reduced = false;
    try {
      reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {}
    const timer = setTimeout(
      () => setShowEntry(false),
      reduced ? ARENA_ENTRY_REDUCED_MS : ARENA_ENTRY_MS,
    );
    return () => clearTimeout(timer);
  }, [showEntry]);

  // Arena music: try on mount (needs a gesture on most browsers, so also arm
  // the first pointerdown). Always stop on unmount.
  useEffect(() => {
    if (musicOn) {
      try {
        startArenaMusic();
      } catch {}
      const arm = () => {
        try {
          startArenaMusic();
        } catch {}
        window.removeEventListener("pointerdown", arm);
      };
      window.addEventListener("pointerdown", arm);
      return () => {
        window.removeEventListener("pointerdown", arm);
        stopArenaMusic();
      };
    }
    stopArenaMusic();
    return undefined;
  }, [musicOn]);

  const toggleMusic = useCallback(() => {
    const next = !musicOn;
    setMusicOn(next);
    try {
      setSoundPrefs({ arenaMusic: next });
    } catch {}
    if (next) {
      try {
        startArenaMusic();
      } catch {}
    } else {
      stopArenaMusic();
    }
    playClick();
  }, [musicOn]);

  const toggleSfx = useCallback(() => {
    const next = !sfxOn;
    setSfxOn(next);
    try {
      setSoundPrefs({ gameResults: next });
    } catch {}
  }, [sfxOn]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reconnectNonce is a deliberate re-trigger key, not a value read in the body.
  useEffect(() => {
    if (!socket) return undefined;
    socket.emit("arena:enter");
    return () => socket.emit("arena:leave");
  }, [socket, reconnectNonce]);

  const raceIdRef = useRef(null);
  useEffect(() => {
    raceIdRef.current = race?.id || null;
  }, [race]);

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

  // Slow board poll: rival finishes don't reach my socket (different rooms),
  // so re-pull while the lobby is visible. Skipped mid-race and on refocus
  // storms — refresh() already covers socket + reconnect moments.
  useEffect(() => {
    const timer = setInterval(() => {
      if (!raceIdRef.current) refreshBoard();
    }, 30000);
    return () => clearInterval(timer);
  }, [refreshBoard]);

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
        setRace(payload);
        playJoin();
      } else if (eventId) {
        setRace((prev) => {
          if (!prev || prev.id !== eventId) return prev;
          if (!payload.id && Array.isArray(payload.players)) {
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

  const busyPlayerIds = useMemo(() => {
    const set = new Set();
    for (const g of myGames) {
      if (g.status !== "pending" && g.status !== "active") continue;
      for (const p of g.players || []) {
        if (p.userId !== myId && p.status !== "declined") set.add(p.userId);
      }
    }
    return set;
  }, [myGames, myId]);

  const liveCount = useMemo(
    () => myGames.filter((g) => g.status === "active").length,
    [myGames],
  );

  const invite = async (targetUserId, name) => {
    if (!targetUserId || busyId) return;
    setBusyId(targetUserId);
    try {
      playInvite();
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
      playJoin();
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
      playClick();
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
      playClick();
      const session = await apiGet(`/api/v1/games/${game.id}`);
      if (gameIsActive(session)) playJoin();
      setRace(session);
    } catch (e) {
      flash(e.message || "Could not open the race");
    }
  };

  const cancel = async (game) => {
    if (busyId) return;
    setBusyId(game.id);
    try {
      playClick();
      await apiPost(`/api/v1/games/${game.id}/cancel`, {});
      await refresh();
    } catch (e) {
      flash(e.message || "Could not cancel");
    } finally {
      setBusyId(null);
    }
  };

  // Solo practice vs bot: born active server-side, so one tap drops straight
  // into the race — no invite, no waiting, no empty-arena dead end.
  const startPractice = async (difficulty) => {
    if (busyId) return;
    setBusyId(`practice-${difficulty}`);
    try {
      playJoin();
      const session = await apiPost("/api/v1/games/practice", { difficulty });
      if (gameIsActive(session)) setRace(session);
      else await refresh();
    } catch (e) {
      playClick();
      flash(e.message || "Could not start practice");
    } finally {
      setBusyId(null);
    }
  };

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
            playClick();
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
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-[var(--bg-base)]">
      <style>{ARENA_KEYFRAMES}</style>
      {/* Arena backdrop: faint flat grid only — no gradient glows. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage:
              "radial-gradient(circle at 50% 0%,black,transparent 78%)",
            WebkitMaskImage:
              "radial-gradient(circle at 50% 0%,black,transparent 78%)",
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 flex shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-base)]/85 px-3 py-2.5 backdrop-blur-md md:px-5">
        <Link
          href="/app"
          aria-label="Back to chats"
          onClick={() => playClick()}
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] transition-all hover:bg-[var(--hover)] hover:text-[var(--text-primary)] active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1
            className="truncate text-[16px] font-semibold leading-tight tracking-tight text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            KIVO ARENA
          </h1>
          <p className="flex items-center gap-1.5 truncate text-[11px] leading-tight text-[var(--text-muted)]">
            <span
              className={`size-1.5 shrink-0 rounded-full ${isConnected ? "bg-emerald-500 animate-[kivo-arena-pulse_1.6s_ease-in-out_infinite] motion-reduce:animate-none" : "bg-amber-500"}`}
            />
            {roster.length > 0
              ? `${roster.length} in the arena${liveCount ? ` · ${liveCount} live` : ""}`
              : isConnected
                ? "Lobby open — invite someone to race"
                : "Connecting…"}
          </p>
        </div>
        {board?.me && (
          <span
            title={`${board.me.xp} XP (${board.me.xpToNext ?? "—"} to LVL ${board.me.level + 1}) · ${board.me.wins}W/${board.me.losses}L · best ${board.me.bestWpm ?? "—"} WPM · ${board.me.dailyStreak || 0}-day play streak`}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-[12px] font-bold tabular-nums text-[var(--text-primary)]"
          >
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            LVL {board.me.level}
            {board.me.currentStreak >= 2 && (
              <>
                <span aria-hidden className="h-3 w-px bg-[var(--border)]" />
                <Flame className="h-3.5 w-3.5 text-orange-500" />
                {board.me.currentStreak}
              </>
            )}
          </span>
        )}
        <button
          type="button"
          onClick={toggleMusic}
          aria-label={musicOn ? "Mute arena music" : "Play arena music"}
          title={musicOn ? "Music on" : "Music off"}
          className={`flex size-9 shrink-0 items-center justify-center rounded-full border transition-all active:scale-95 ${
            musicOn
              ? "border-[var(--accent)]/40 bg-[var(--accent)]/12 text-[var(--accent)]"
              : "border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          <Music className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            toggleSfx();
            playClick();
          }}
          aria-label={sfxOn ? "Mute game sounds" : "Unmute game sounds"}
          title={sfxOn ? "Sounds on" : "Sounds off"}
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] transition-all hover:bg-[var(--hover)] hover:text-[var(--text-primary)] active:scale-95"
        >
          {sfxOn ? (
            <Volume2 className="h-4 w-4" />
          ) : (
            <VolumeX className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            playClick();
            refresh();
          }}
          aria-label="Refresh arena"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] transition-all hover:bg-[var(--hover)] hover:text-[var(--text-primary)] active:scale-95"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </header>

      {/* Scrollable arena */}
      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-4 md:px-6 md:py-6">
          {/* Hero — flat surface card, no gradient wash. */}
          <section className="t-panel-in relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-xl md:p-6">
            <div className="relative flex flex-col gap-4 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--text-muted)]">
                  <Zap className="h-3 w-3" /> 1v1 · Typing Race · Live
                </p>
                <h2
                  className="mt-1 text-[26px] font-semibold leading-[1.05] tracking-tight text-[var(--text-primary)] md:text-[32px]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Type fastest.
                  <br />
                  Win loud.
                </h2>
                <p className="mt-1.5 max-w-md text-[13px] leading-snug text-[var(--text-muted)]">
                  Pick someone below — the invite lands as a chip in your DM,
                  the race runs here on one shared clock.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[var(--text-primary)]">
                    <Users className="h-3 w-3" /> {roster.length} here
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[var(--text-primary)]">
                    <Swords className="h-3 w-3" /> {invites.length} invites
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[var(--text-primary)]">
                    <Zap className="h-3 w-3" /> {liveCount} live
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
                <span className="flex size-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)]">
                  <Keyboard className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-[13px] font-bold leading-tight text-[var(--text-primary)]">
                    First to finish wins
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Server clock · WPM ≤ 400
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Lobby + live board. Sidebar docks right on desktop, stacks below on mobile. */}
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="flex min-w-0 flex-col gap-5">
              {/* Practice — solo vs bot. Flat cards, lucide icons only. */}
              <section>
                <div className="mb-2.5 flex items-center justify-between">
                  <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    <Bot className="h-3.5 w-3.5" /> Practice
                  </h2>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    Solo vs bot · instant start
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {PRACTICE_DIFFICULTIES.map((d, i) => {
                    const Icon =
                      d.id === "easy" ? Gauge : d.id === "hard" ? Flame : Zap;
                    const busy = busyId === `practice-${d.id}`;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => startPractice(d.id)}
                        disabled={Boolean(busyId)}
                        style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
                        className="t-item-in group flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] hover:cursor-pointer p-3 text-left transition-all hover:border-[var(--text-muted)]/40 active:scale-[0.98] disabled:opacity-60"
                      >
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)]">
                          {busy ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <Icon className="h-5 w-5" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13.5px] font-semibold text-[var(--text-primary)]">
                            {d.label}
                          </span>
                          <span className="block truncate text-[11px] text-[var(--text-muted)]">
                            {d.botName} · ~{d.wpm} WPM
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Your games */}
              {(invites.length > 0 || myGames.length > 0) && (
                <section>
                  <div className="mb-2.5 flex items-center justify-between">
                    <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      <Swords className="h-3.5 w-3.5" /> Your games
                    </h2>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Tap to jump back in
                    </span>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {invites.map((game, i) => {
                      const host = (game.players || []).find(
                        (p) => p.userId !== myId,
                      );
                      const meta = gameKindMeta(game.kind);
                      return (
                        <div
                          key={game.id}
                          className="t-item-in flex items-center gap-3 rounded-2xl border border-[var(--accent)]/35 bg-[var(--accent)]/[0.07] p-3"
                          style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
                        >
                          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)]">
                            <Keyboard className="h-5 w-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1">
                              <StatusPill tone="invite">Invite</StatusPill>
                            </div>
                            <p className="truncate text-[13.5px] font-semibold text-[var(--text-primary)]">
                              {host?.displayName || "Someone"} challenged you
                              {Number(game.round) > 1
                                ? ` · Game ${game.round}`
                                : ""}
                            </p>
                            <p className="truncate text-[11px] text-[var(--text-muted)]">
                              {meta.label} · 1v1
                              {Number(game.round) > 1 ? ` · rematch` : ""} · tap
                              Accept to start
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col gap-1.5">
                            <ArenaButton
                              label={`Accept race vs ${host?.displayName || "player"}`}
                              onClick={() => accept(game)}
                              busy={busyId === game.id}
                            >
                              Accept
                            </ArenaButton>
                            <button
                              type="button"
                              onClick={() => decline(game)}
                              disabled={busyId === game.id}
                              className="rounded-full px-3 py-1.5 text-[11.5px] font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--destructive)] disabled:opacity-50"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {myGames.map((game, i) => {
                      const opponent = (game.players || []).find(
                        (p) => p.userId !== myId,
                      );
                      const active = gameIsActive(game);
                      const awaiting =
                        !active && playerFor(game, myId)?.status === "joined";
                      const results = gameResults(game);
                      const winner = results[0] || null;
                      const label = active
                        ? "Racing now"
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
                          className={`t-item-in flex items-center gap-3 rounded-2xl border p-3 ${
                            active
                              ? "border-emerald-500/35 bg-emerald-500/[0.06]"
                              : "border-[var(--border)] bg-[var(--bg-surface)]"
                          }`}
                          style={{
                            animationDelay: `${Math.min(i + invites.length, 8) * 40}ms`,
                          }}
                        >
                          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)]">
                            <Keyboard className="h-5 w-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1">
                              <StatusPill
                                tone={active ? "live" : "waiting"}
                                live={active}
                              >
                                {active ? "Live" : "Waiting"}
                              </StatusPill>
                            </div>
                            <p className="truncate text-[13.5px] font-semibold text-[var(--text-primary)]">
                              vs {opponent?.displayName || "Opponent"}
                              {Number(game.round) > 1
                                ? ` · G${game.round}`
                                : ""}
                            </p>
                            <p className="truncate text-[11px] text-[var(--text-muted)]">
                              {Number(game.round) > 1
                                ? `Rematch · ${label}`
                                : label}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <ArenaButton
                              label={active ? "Join live race" : "Open game"}
                              variant={active ? "primary" : "secondary"}
                              onClick={() => open(game)}
                            >
                              {active ? "Join" : "Open"}
                            </ArenaButton>
                            {isHost(game, myId) && !active && (
                              <button
                                type="button"
                                onClick={() => cancel(game)}
                                disabled={busyId === game.id}
                                className="px-1 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--destructive)] disabled:opacity-50"
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

              {/* In the arena */}
              <section>
                <div className="mb-2.5 flex items-center justify-between">
                  <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    <Users className="h-3.5 w-3.5" /> In the arena
                    {roster.length > 0 && (
                      <span className="ml-1 rounded-full bg-[var(--accent)]/12 px-2 py-0.5 text-[10px] font-bold text-[var(--accent)]">
                        {roster.length}
                      </span>
                    )}
                  </h2>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    Live right now
                  </span>
                </div>
                {roster.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)]/50 px-4 py-8 text-center">
                    <p className="flex items-center justify-center gap-2 text-[13.5px] font-medium text-[var(--text-primary)]">
                      <Music className="h-4 w-4 text-[var(--text-muted)]" />
                      Arena is quiet — cue the music
                    </p>
                    <p className="mx-auto mt-1 max-w-sm text-[12px] text-[var(--text-muted)]">
                      No one else is here yet. Invite a friend below — it lands
                      as a chip in your chat and the race starts the moment they
                      accept.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {roster.map((m, i) => {
                      const id = m.userId || m.id;
                      const busy = busyPlayerIds.has(id);
                      return (
                        <PlayerCard
                          key={id}
                          index={i}
                          name={m.displayName}
                          username={m.username}
                          online
                          statusLine="In the arena · ready to race"
                          action={
                            busy ? (
                              <span className="shrink-0 rounded-full bg-[var(--bg-elevated)] px-3 py-2 text-[11px] font-semibold text-[var(--text-muted)]">
                                In game
                              </span>
                            ) : (
                              <ArenaButton
                                label={`Invite ${m.displayName || "player"}`}
                                onClick={() => invite(id, m.displayName)}
                                disabled={busy}
                                busy={busyId === id}
                              >
                                <Send className="h-3.5 w-3.5" /> Invite
                              </ArenaButton>
                            )
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Friends */}
              <section>
                <div className="mb-2.5 flex items-center justify-between">
                  <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    <Trophy className="h-3.5 w-3.5" /> Friends
                  </h2>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {friends.filter((f) => onlineIds.has(String(f.id))).length}{" "}
                    online
                  </span>
                </div>
                {loading ? (
                  <div className="flex items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)]" />
                  </div>
                ) : friends.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)]/50 px-4 py-8 text-center">
                    <p className="text-[13.5px] font-medium text-[var(--text-primary)]">
                      No rivals yet
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                      Add friends to fill your arena with challengers.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {friends.map((f, i) => {
                      const online = onlineIds.has(String(f.id));
                      const busy = busyPlayerIds.has(f.id);
                      return (
                        <PlayerCard
                          key={f.id}
                          index={i}
                          name={f.displayName}
                          username={f.username}
                          online={online}
                          statusLine={
                            online
                              ? "Online · ready"
                              : "Offline · invite anyway"
                          }
                          action={
                            busy ? (
                              <span className="shrink-0 rounded-full bg-[var(--bg-elevated)] px-3 py-2 text-[11px] font-semibold text-[var(--text-muted)]">
                                In game
                              </span>
                            ) : (
                              <ArenaButton
                                label={`Invite ${f.displayName || "friend"}`}
                                onClick={() => invite(f.id, f.displayName)}
                                disabled={busy}
                                busy={busyId === f.id}
                              >
                                <Send className="h-3.5 w-3.5" /> Invite
                              </ArenaButton>
                            )
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* Weekly board — live on the right. Flat card, tabular numerals,
                lucide icons only. */}
            <aside className="min-w-0 lg:sticky lg:top-4">
              <section
                aria-label="Weekly leaderboard"
                className="flex flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-xl"
              >
                <div className="flex items-center gap-2 px-4 pb-1 pt-4">
                  <Trophy className="h-4 w-4 shrink-0 text-amber-500" />
                  <h2 className="flex-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Weekly board
                  </h2>
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-500">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-[kivo-arena-pulse_1.6s_ease-in-out_infinite] motion-reduce:animate-none" />
                    Live
                  </span>
                </div>
                <p className="px-4 pb-2 text-[11px] text-[var(--text-muted)]">
                  Best WPM this week ·{" "}
                  {board ? formatBoardReset(board.endsAt) : "Loading…"}
                </p>
                <div className="max-h-[380px] overflow-y-auto px-2 pb-2">
                  {!board ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)]" />
                    </div>
                  ) : board.entries.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-7 text-center">
                      <p className="text-[13px] font-medium text-[var(--text-primary)]">
                        No races this week
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                        Win one race and the board is yours.
                      </p>
                    </div>
                  ) : (
                    board.entries.map((e) => (
                      <div
                        key={e.userId}
                        className={`flex items-center gap-2.5 rounded-xl px-2 py-2 ${
                          e.isMe
                            ? "border border-[var(--accent)]/35 bg-[var(--accent)]/[0.07]"
                            : "border border-transparent"
                        }`}
                      >
                        <span
                          className={`w-6 shrink-0 text-center text-[12px] tabular-nums ${
                            e.rank <= 3
                              ? "font-bold text-[var(--text-primary)]"
                              : "font-medium text-[var(--text-muted)]"
                          }`}
                        >
                          {e.rank}
                        </span>
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/12 text-[11px] font-bold text-[var(--accent)]">
                          {initialsFor(e.displayName)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-[var(--text-primary)]">
                            {e.displayName}
                            {e.isMe ? " (you)" : ""}
                          </span>
                          <span className="block truncate text-[11px] tabular-nums text-[var(--text-muted)]">
                            {e.games} {e.games === 1 ? "race" : "races"} ·{" "}
                            {e.wins}W
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-[14px] font-bold tabular-nums text-[var(--text-primary)]">
                            {e.bestWpm}
                          </span>
                          <span className="block text-[10px] tabular-nums text-[var(--text-muted)]">
                            avg {e.avgWpm ?? "—"}
                          </span>
                        </span>
                      </div>
                    ))
                  )}
                </div>
                {board?.me && (
                  <div className="border-t border-[var(--border)] px-4 py-2.5 text-[11.5px] text-[var(--text-muted)]">
                    {board.me.rank ? (
                      <span>
                        You ·{" "}
                        <span className="font-bold tabular-nums text-[var(--text-primary)]">
                          #{board.me.rank}
                        </span>{" "}
                        · {board.me.weekBestWpm} WPM best · {board.me.weekGames}{" "}
                        {board.me.weekGames === 1 ? "race" : "races"}
                        {board.me.dailyStreak >= 2 && (
                          <> · {board.me.dailyStreak}-day streak</>
                        )}
                      </span>
                    ) : (
                      <span>Race once to enter the board.</span>
                    )}
                  </div>
                )}
              </section>
            </aside>
          </div>

          <p className="pb-2 text-center text-[11px] text-[var(--text-muted)]">
            Invites and results live in your DM as a chip — the battle stays
            here.
          </p>
        </div>
      </div>

      {resultFlashNode}

      {/* Welcome gate — the "you are entering somewhere" moment. Flat
          surfaces + lucide icon only, tap skips. Shown only on rail/menu
          entry, never on reloads or chip returns. */}
      {showEntry && (
        <button
          type="button"
          onClick={() => setShowEntry(false)}
          aria-label="Enter the Game Arena"
          style={{
            animation: `kivo-arena-gate-wash ${ARENA_ENTRY_MS}ms ease both`,
          }}
          className="fixed inset-0 z-[110] flex cursor-pointer flex-col items-center justify-center gap-4 border-0 bg-[var(--bg-base)] px-6 motion-reduce:animate-none"
        >
          <span
            aria-hidden
            className="flex size-16 items-center justify-center rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] animate-[kivo-arena-gate-in_450ms_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none"
          >
            <Gamepad2 className="h-8 w-8" />
          </span>
          <span className="flex flex-col items-center gap-1.5 text-center animate-[kivo-arena-gate-in_450ms_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none">
            <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--text-muted)]">
              Welcome
            </span>
            <span
              className="max-w-full truncate text-[34px] font-semibold leading-none tracking-tight text-[var(--text-primary)] md:text-[42px]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {me?.displayName || me?.username || "Player"}
            </span>
            <span className="text-[13px] font-medium text-[var(--text-muted)]">
              to the Game Arena
            </span>
          </span>
        </button>
      )}

      {notice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[max(env(safe-area-inset-bottom),1rem)] z-50 flex justify-center px-4">
          <div className="t-panel-in rounded-full border border-[var(--border)] bg-[var(--bg-elevated)]/95 px-4 py-2 text-[12.5px] font-medium text-[var(--text-primary)] shadow-xl backdrop-blur-md">
            {notice}
          </div>
        </div>
      )}
    </div>
  );
}

export default GamesArena;
