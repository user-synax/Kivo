"use client";

import { Check, Crown, Loader2, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/dashboard/avatar";
import { apiGet, apiPost } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { cn } from "@/lib/utils";

const FOUNDER_USERNAME = "ayush";

export function RichEmptyState({
  icon: Icon,
  title,
  hint,
  actionLabel,
  onAction,
  compact = false,
  children,
  className,
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        compact ? "gap-1.5 px-4 py-8" : "gap-2 px-4 py-10",
        className,
      )}
    >
      {Icon && (
        <span
          className={cn(
            "grid place-items-center rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)]",
            compact ? "size-10" : "size-12",
          )}
          aria-hidden="true"
        >
          <Icon className={compact ? "h-5 w-5" : "h-6 w-6"} strokeWidth={1.6} />
        </span>
      )}
      {title && (
        <p
          className={cn(
            "font-medium text-[var(--text-primary)]",
            compact ? "text-[13px]" : "text-sm",
          )}
        >
          {title}
        </p>
      )}
      {hint && (
        <p
          className={cn(
            "max-w-[260px] leading-relaxed text-[var(--text-muted)]",
            compact ? "text-[12px]" : "text-[13px]",
          )}
        >
          {hint}
        </p>
      )}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-1.5 text-[12px] font-semibold text-[var(--on-accent)] transition-opacity duration-150 hover:opacity-90"
        >
          {actionLabel}
        </button>
      )}
      {children}
    </div>
  );
}

// Small welcome card pointing new users (no friends yet) at the founder.
// When `friendsCount` is provided the parent gates visibility; otherwise the
// card fetches the friend list itself and hides unless it is empty — so it
// can be dropped into any empty state (sidebar, friends modal) and still
// obey the "only when the user has no friends" rule.
export function FounderInviteCard({ className, onSent, friendsCount }) {
  const [status, setStatus] = useState("idle"); // idle | sending | sent | requested | friends
  const [error, setError] = useState(null);
  const [founder, setFounder] = useState(null);
  const [checkedCount, setCheckedCount] = useState(
    typeof friendsCount === "number" ? friendsCount : null,
  );

  const me = getSession();
  const isSelf = me?.username?.toLowerCase() === FOUNDER_USERNAME.toLowerCase();

  // Best-effort avatar lookup — falls back to initials if search fails.
  useEffect(() => {
    if (isSelf) return;
    let active = true;
    apiGet(`/api/v1/users/search?q=${FOUNDER_USERNAME}`)
      .then((list) => {
        if (!active) return;
        const match = (list || []).find(
          (u) =>
            (u.username || "").toLowerCase() === FOUNDER_USERNAME.toLowerCase(),
        );
        if (match) setFounder(match);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isSelf]);

  // Self-gating: when the parent doesn't pass a count, check the friend list
  // directly so the card never shows for users who already have friends.
  useEffect(() => {
    if (typeof friendsCount === "number") {
      setCheckedCount(friendsCount);
      return;
    }
    if (isSelf) return;
    let active = true;
    apiGet("/api/v1/friends")
      .then((list) => {
        if (active) setCheckedCount(Array.isArray(list) ? list.length : 0);
      })
      .catch(() => {
        if (active) setCheckedCount(null);
      });
    return () => {
      active = false;
    };
  }, [friendsCount, isSelf]);

  if (isSelf) return null;
  // Still checking, or the user already has friends → render nothing.
  if (typeof friendsCount !== "number" && checkedCount !== 0) return null;

  const send = async () => {
    if (status === "sending" || status === "sent") return;
    setStatus("sending");
    setError(null);
    try {
      await apiPost("/api/v1/friends/request", {
        identifier: FOUNDER_USERNAME,
      });
      setStatus("sent");
      onSent?.();
    } catch (err) {
      const msg = err?.message || "Could not send request";
      // Treat duplicate/already-friends responses as terminal states, not errors.
      if (/already|pending|duplicate/i.test(msg)) {
        setStatus(/friend/i.test(msg) ? "friends" : "requested");
      } else {
        setError(msg);
        setStatus("idle");
      }
    }
  };

  return (
    <div
      className={cn(
        "mx-3 mt-2 rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent)]/[0.07] p-3 text-left",
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <Avatar
          name={founder?.displayName || "Ayush"}
          avatarStyle={founder?.avatarStyle}
          url={founder?.avatarUrl}
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--text-primary)]">
            <Crown
              className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]"
              aria-hidden="true"
            />
            Say hello to the founder
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-muted)]">
            Message the founder and author of the app:{" "}
            <span className="font-medium text-[var(--text-primary)]">
              @{FOUNDER_USERNAME}
            </span>{" "}
            — send them a friend request.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={send}
        disabled={status === "sending" || status === "sent"}
        className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--on-accent)] transition-opacity duration-150 hover:opacity-90 disabled:pointer-events-none disabled:opacity-60"
      >
        {status === "sending" ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            Sending…
          </>
        ) : status === "sent" ? (
          <>
            <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
            Request sent
          </>
        ) : status === "requested" ? (
          "Already requested"
        ) : status === "friends" ? (
          "Already friends"
        ) : (
          <>
            <UserPlus className="h-3.5 w-3.5" strokeWidth={2} />
            Add @{FOUNDER_USERNAME}
          </>
        )}
      </button>
      {error && (
        <p className="mt-1.5 text-center text-[11px] text-[var(--destructive)]">
          {error}
        </p>
      )}
    </div>
  );
}
