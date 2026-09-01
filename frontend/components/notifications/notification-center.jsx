"use client";

import { CheckCheck, Bell, Loader2 } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { Avatar } from "@/components/dashboard/avatar";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/chat";
import { useIsDesktop } from "@/lib/use-breakpoint";

const EASE = [0.22, 1, 0.36, 1];

function RelativeTime({ date }) {
  if (!date) return null;
  return <span>{formatTime(date)}</span>;
}

export function NotificationCenter({
  open,
  onClose,
  notifications = [],
  nextCursor,
  hasMore,
  loading,
  onLoadMore,
  onMarkAllRead,
  onSelect,
  unreadCount = 0,
}) {
  const reduce = useReducedMotion();
  const scrollRef = useRef(null);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    function onDoc(e) {
      const el = document.getElementById("kivo-notification-center");
      const bell = document.getElementById("kivo-notification-bell-wrap");
      if (el && !el.contains(e.target) && bell && !bell.contains(e.target)) {
        onClose?.();
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDoc);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [open, onClose]);

  const handleScroll = (e) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
      if (hasMore && !loading && nextCursor) onLoadMore?.();
    }
  };

  const header = (
    <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Notifications</h2>
        {unreadCount > 0 && (
          <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-semibold text-[var(--on-accent)]">
            {unreadCount > 99 ? "99+" : unreadCount} new
          </span>
        )}
      </div>
      {unreadCount > 0 && (
        <button
          type="button"
          onClick={onMarkAllRead}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
        >
          <CheckCheck className="h-3.5 w-3.5" strokeWidth={1.8} />
          Mark all read
        </button>
      )}
    </div>
  );

  const list = (
    <div ref={scrollRef} onScroll={handleScroll} className="t-scroll min-h-0 flex-1 overflow-y-auto">
      {notifications.length === 0 && !loading ? (
        <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)]">
            <Bell className="h-5 w-5" strokeWidth={1.6} />
          </span>
          <p className="text-sm font-medium text-[var(--text-primary)]">No notifications yet</p>
          <p className="text-[12px] text-[var(--text-muted)]">When someone messages you or sends a friend request, it’ll show up here.</p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {notifications.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => onSelect?.(n)}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--hover)]",
                  !n.read && "bg-[var(--bg-surface)]"
                )}
              >
                <span className="relative mt-0.5 shrink-0">
                  <Avatar name={n.title || "Kivo"} url={n.avatarUrl} size="sm" />
                  {!n.read && (
                    <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-[var(--accent)] ring-2 ring-[var(--bg-surface)]" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className={cn("truncate text-[13px] font-medium", !n.read ? "text-[var(--text-primary)]" : "text-[var(--text-primary)]/90")}>
                      {n.title || "Notification"}
                    </span>
                    <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
                      <RelativeTime date={n.createdAt} />
                    </span>
                  </span>
                  {n.body ? (
                    <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-[var(--text-muted)]">
                      {n.body}
                    </span>
                  ) : null}
                  <span className="mt-1 inline-flex rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)] border border-[var(--border)]">
                    {n.type === "dm_message"
                      ? "DM"
                      : n.type === "group_message"
                        ? "Group"
                        : n.type === "space_message"
                          ? "Space"
                          : n.type === "friend_request"
                            ? "Friend request"
                            : n.type === "friend_accept"
                              ? "Accepted"
                              : n.type === "mention"
                                ? "Mention"
                                : n.type}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-3 text-[12px] text-[var(--text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          Loading…
        </div>
      )}
      {!loading && hasMore && nextCursor && (
        <div className="flex justify-center px-4 py-2">
          <button type="button" onClick={onLoadMore} className="rounded-full border border-[var(--border)] px-3 py-1 text-[12px] font-medium text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]">
            Load more
          </button>
        </div>
      )}
    </div>
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close notifications"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.18, ease: EASE }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
          />
          {!isDesktop ? (
            <motion.div
              id="kivo-notification-center"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={reduce ? { duration: 0 } : { duration: 0.28, ease: EASE }}
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-3xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl pb-[max(env(safe-area-inset-bottom),0.75rem)]"
              role="dialog"
              aria-label="Notifications"
            >
              <div className="mx-auto mt-3 h-1.5 w-9 shrink-0 rounded-full bg-[var(--border)]" aria-hidden="true" />
              {header}
              {list}
            </motion.div>
          ) : (
            <motion.div
              id="kivo-notification-center"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
              transition={reduce ? { duration: 0 } : { duration: 0.22, ease: EASE }}
              className={cn(
                "fixed left-1/2 top-1/2 z-50 flex max-h-[min(82vh,560px)] w-[92vw] max-w-[420px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl",
                "origin-center sm:w-[420px]",
                "max-sm:w-[92vw]"
              )}
              role="dialog"
              aria-label="Notifications"
            >
              {header}
              {list}
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}

export default NotificationCenter;
