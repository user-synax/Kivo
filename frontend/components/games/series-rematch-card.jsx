"use client";

import { Loader2, RotateCcw, Swords, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { seriesKeyFor, seriesScoreText } from "@/lib/games";
import { playClick, playJoin } from "@/lib/sound";

// Best-of series + one-tap rematch card, shared by every game stage.
// Same DM thread: rematch creates Game N+1 in the session's conversation.
// First to `winsNeeded` takes the series; an opponent's rematch surfaces as
// an Accept banner via polling (socket only covers the open race id).
// Flat surfaces + lucide icons only — no gradients, no emojis.

export function SeriesRematchCard({
  session,
  viewerId,
  opponentId,
  opponentName,
  onSession,
  onClose,
}) {
  const [series, setSeries] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const sessionId = session?.id || null;

  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on race identity + status; session object identity churns on progress/move events.
  useEffect(() => {
    if (!session || session.status !== "finished") {
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

  const seriesDone = Boolean(series?.isComplete);
  const seriesGames = Array.isArray(series?.games) ? series.games : [];
  const bestOf = Number(series?.bestOf) || 3;
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
    if (!sessionId || busy) return;
    setBusy(true);
    setError(null);
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
      setError(e?.message || "Could not start a rematch");
    } finally {
      setBusy(false);
    }
  };

  const joinRematch = async () => {
    if (!liveRematch || busy) return;
    setBusy(true);
    setError(null);
    try {
      playJoin();
      const next = await apiPost(`/api/v1/games/${liveRematch.id}/join`, {});
      onSession?.(next);
    } catch (e) {
      setError(e?.message || "Could not join the rematch");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
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
                  ? `Game ${i + 1}: ${mine ? "you won" : theirs ? `${opponentName || "opponent"} won` : "no result"}`
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
              {series?.winnerId && String(series.winnerId) === String(viewerId)
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
                ? `${opponentName || "Opponent"} wants a rematch`
                : `Game ${liveRematch.round || nextRound} waiting`}
            </p>
            <p className="truncate text-[11px] text-[var(--text-muted)]">
              Same chat thread · first to {Number(series?.winsNeeded) || 2}
            </p>
          </div>
          <button
            type="button"
            onClick={
              liveRematchInvitesMe
                ? joinRematch
                : () => onSession?.(liveRematch)
            }
            disabled={busy}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[12.5px] font-semibold text-black transition-all hover:brightness-90 active:scale-95 disabled:opacity-50"
          >
            {busy ? (
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
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-3.5 py-2.5 text-[13px] font-semibold text-black transition-all hover:brightness-90 active:scale-95 disabled:opacity-50 min-h-[42px]"
          >
            {busy ? (
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
      {error && (
        <p className="text-[12px] text-[var(--destructive)]">{error}</p>
      )}
      {!series && (
        <p className="text-[11px] text-[var(--text-muted)]">Loading series…</p>
      )}
    </div>
  );
}

export default SeriesRematchCard;
