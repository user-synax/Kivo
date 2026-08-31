"use client";

import { Bell } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1];

export function NotificationBell({ unreadCount = 0, onClick, isOpen = false }) {
  const showBadge = unreadCount > 0;
  const displayCount = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={showBadge ? `Notifications, ${unreadCount} unread` : "Notifications"}
      aria-expanded={isOpen}
      aria-haspopup="dialog"
      className={cn(
        "kivo-focus relative flex size-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]",
        isOpen && "bg-[var(--hover)] text-[var(--text-primary)]"
      )}
    >
      <Bell className="h-[18px] w-[18px]" strokeWidth={1.7} aria-hidden="true" />
      <AnimatePresence>
        {showBadge && (
          <motion.span
            key="badge"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="absolute -right-1 -top-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[11px] font-semibold leading-none text-[var(--on-accent)] shadow-sm ring-2 ring-[var(--bg-elevated)]"
          >
            {displayCount}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

export default NotificationBell;
