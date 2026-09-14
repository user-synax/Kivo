"use client";

import { ChevronRight, Crown, Keyboard, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  formatAccuracy,
  formatGap,
  formatMs,
  formatWpm,
  gameKindMeta,
  isHost,
  isInGame,
  playerFor,
  raceMarginMs,
} from "@/lib/games";

// Kivo Games chat chip.
//
// Chat is deliberately NOT the play surface — a game only ever appears here as a
// one-line chip. There are two kinds:
//   role "invite"  — created when someone proposes a game; tracks waiting/in-progress.
//   role "result"  — posted when the race concludes, so the outcome is shared with
//                    its own notification and unread badge.
// Tapping either opens the full-screen arena at /games.

function inviteStatus(game, viewerId) {
  const opponent = (game.players || []).find((p) => p.userId !== viewerId);
  const opponentName = opponent?.displayName || "your opponent";
  const noun = game?.kind === "chess" ? "Game" : "Race";

  switch (game?.status) {
    case "active":
      return `${noun} in progress — tap to watch`;
    case "finished":
    case "cancelled":
      return `${noun} finished`;
    case "pending": {
      const me = playerFor(game, viewerId);
      if (me?.status === "invited") return "Invited you — tap to accept";
      if (isHost(game, viewerId)) return `Waiting for ${opponentName}`;
      if (isInGame(game, viewerId)) return "Waiting to begin";
      return "Invite pending";
    }
    default:
      return "Open in Games";
  }
}

export function GameChip({ game, viewerId }) {
  const router = useRouter();
  if (!game) return null;

  const meta = gameKindMeta(game.kind);
  const isResult = game.role === "result";
  const winner = (game.players || []).find((p) => p.userId === game.winnerId);
  const iWon = Boolean(winner && winner.userId === viewerId);

  const me = playerFor(game, viewerId);
  const needsAction =
    !isResult && (game.status === "active" || me?.status === "invited");

  const roundSuffix = Number(game.round) > 1 ? ` · G${game.round}` : "";
  const title = isResult
    ? `${meta.label}${roundSuffix} — ${iWon ? "you won" : `${winner?.displayName || "Someone"} won`}`
    : `${meta.label}${roundSuffix}`;

  // A photo finish is the most interesting thing about a result, so it leads the
  // line — and it is only available when both players have a recorded time.
  const margin = isResult ? raceMarginMs(game) : null;
  const subtitle = isResult
    ? [
        margin != null ? `won by ${formatGap(margin)}` : null,
        Number.isFinite(winner?.wpm) ? formatWpm(winner.wpm) : null,
        Number.isFinite(winner?.accuracy)
          ? formatAccuracy(winner.accuracy)
          : null,
        Number.isFinite(winner?.elapsedMs) ? formatMs(winner.elapsedMs) : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : inviteStatus(game, viewerId);

  return (
    <button
      type="button"
      onClick={() => router.push("/games")}
      className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-left transition-colors hover:bg-[var(--hover)]"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/12 text-sm text-[var(--accent)]">
        {isResult ? (
          <Trophy className="h-4 w-4 text-amber-500" />
        ) : game.kind === "chess" ? (
          <Crown className="h-4 w-4" />
        ) : (
          <Keyboard className="h-4 w-4" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium text-[var(--text-primary)]">
          {title}
        </span>
        <span className="block truncate text-[11px] text-[var(--text-muted)]">
          {subtitle || "Open in Games"}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-[var(--accent)]">
        {needsAction ? "Open" : "View"}
        <ChevronRight className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

export default GameChip;
