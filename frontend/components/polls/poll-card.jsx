"use client";
import { BarChart3, Check, Clock, EyeOff } from "lucide-react";
import { useState } from "react";
import {
  pollIsExpired,
  pollPercent,
  pollTimeLeft,
  pollTotalVotes,
} from "@/lib/polls";

export function PollCard({ poll, mine, onVote, onRetract, onEnd, busy }) {
  const [pending, setPending] = useState(null);
  if (!poll) return null;
  const total = pollTotalVotes(poll);
  const expired = pollIsExpired(poll) || poll.isClosed;
  const viewerVotes = new Set(poll.viewerVotes || []);

  const toggle = async (optId) => {
    if (expired || busy) return;
    const isSelected = viewerVotes.has(optId);
    if (isSelected) {
      if (poll.allowMultiple) {
        const next = [...viewerVotes].filter((id) => id !== optId);
        if (next.length === 0) {
          await onRetract?.();
        } else {
          setPending(optId);
          try {
            await onVote(next);
          } finally {
            setPending(null);
          }
        }
      } else {
        await onRetract?.();
      }
      return;
    }
    let nextIds;
    if (poll.allowMultiple) nextIds = [...viewerVotes, optId];
    else nextIds = [optId];
    setPending(optId);
    try {
      await onVote(nextIds);
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
      <div className="p-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <p className="break-words text-sm font-semibold leading-snug text-[var(--text-primary)] [overflow-wrap:anywhere]">
            {poll.question}
          </p>
          {poll.anonymous && (
            <span className="flex shrink-0 items-center gap-1 text-[10px] text-[var(--text-muted)]">
              <EyeOff className="h-3 w-3" /> anonymous
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
          <span className="flex items-center gap-1">
            <BarChart3 className="h-3 w-3" />
            {total} vote{total !== 1 ? "s" : ""}
          </span>
          {poll.expiresAt && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {poll.isClosed || expired
                ? "ended"
                : pollTimeLeft(poll.expiresAt)}
            </span>
          )}
          {poll.allowMultiple && <span>· multiple</span>}
        </div>
      </div>
      <div className="flex flex-col gap-1.5 px-2 pb-2">
        {(poll.options || []).map((opt) => {
          const pct = pollPercent(opt, total);
          const selected = viewerVotes.has(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              disabled={expired || busy}
              onClick={() => toggle(opt.id)}
              className={`relative overflow-hidden rounded-lg border text-left transition-colors ${selected ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--border)] bg-[var(--bg-elevated)] hover:bg-[var(--hover)]"} ${expired ? "cursor-default" : "cursor-pointer"}`}
            >
              <div
                className="absolute inset-y-0 left-0 bg-[var(--accent)]/15 transition-all"
                style={{ width: `${pct}%` }}
                aria-hidden
              />
              <div className="relative flex items-center justify-between gap-2 px-3 py-2">
                <span className="flex items-center gap-2 text-[13px] text-[var(--text-primary)]">
                  <span
                    className={`flex size-4 items-center justify-center rounded-full border text-[10px] ${selected ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)] bg-transparent"}`}
                  >
                    {selected && <Check className="h-3 w-3" />}
                  </span>
                  <span className="break-words [overflow-wrap:anywhere]">
                    {opt.text}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] font-medium text-[var(--text-muted)]">
                  {pct}% · {opt.count}
                </span>
              </div>
              {pending === opt.id && (
                <span
                  className="absolute inset-0 animate-pulse bg-white/5"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between border-t border-[var(--border)] px-3 py-1.5">
        <span className="text-[11px] text-[var(--text-muted)]">
          {expired
            ? "Poll ended"
            : viewerVotes.size
              ? "Tap to change vote"
              : "Tap an option to vote"}
        </span>
        {mine && !expired && !poll.isClosed && (
          <button
            type="button"
            onClick={onEnd}
            disabled={busy}
            className="text-[11px] font-medium text-[var(--accent)] hover:underline disabled:opacity-50"
          >
            End poll
          </button>
        )}
      </div>
    </div>
  );
}
