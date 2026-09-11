"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Loader2, Send, MessageSquare, UserPlus, X } from "lucide-react";
import { Avatar } from "@/components/dashboard/avatar";
import { useIsDesktop } from "@/lib/use-breakpoint";

const EASE = [0.22, 1, 0.36, 1];

// Modal to send friend request with optional welcome message
export function SendRequestModal({ open, user, onClose, onSend }) {
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [busyMode, setBusyMode] = useState(null); // "with" | "without" | null
  const isDesktop = useIsDesktop();
  const reduce = useReducedMotion();

  const [render, setRender] = useState(open);
  const [show, setShow] = useState(false);
  const closeMs = 150;

  useEffect(() => {
    if (open) {
      setRender(true);
      setWelcomeMessage("");
      setBusyMode(null);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setShow(true)));
      return () => cancelAnimationFrame(id);
    }
    if (render) {
      setShow(false);
      const id = setTimeout(() => setRender(false), closeMs);
      return () => clearTimeout(id);
    }
  }, [open, render]);

  useEffect(() => {
    if (!render) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [render, onClose]);

  if (!render || !user) return null;

  const fullName = user.displayName || user.username || user.email || "Unknown";
  const handle = user.username ? `@${user.username}` : user.email || "";
  const hasMessage = welcomeMessage.trim().length > 0;

  const handleSend = async (withMessage) => {
    const msg = withMessage ? welcomeMessage.trim() : "";
    if (withMessage && !msg) return;
    setBusyMode(withMessage ? "with" : "without");
    try {
      await onSend?.(msg || null, withMessage);
    } finally {
      setBusyMode(null);
    }
  };

  const content = (
    <>
      {/* Profile preview header */}
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-3">
        <Avatar name={fullName} avatarStyle={user.avatarStyle} url={user.avatarUrl} isPlus={Boolean(user.isPlus)} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{fullName}</p>
          <p className="truncate text-xs text-[var(--text-muted)]">{handle}</p>
          {user.bio && <p className="line-clamp-1 mt-0.5 text-xs text-[var(--text-muted)]/70">{user.bio}</p>}
        </div>
      </div>

      <div className="mt-4">
        <label className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-primary)]">
          <MessageSquare className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          Welcome message
          <span className="font-normal text-[var(--text-muted)]">(optional, max 280)</span>
        </label>
        <textarea
          value={welcomeMessage}
          onChange={(e) => setWelcomeMessage(e.target.value.slice(0, 280))}
          placeholder={`Hi ${user.displayName || user.username || "there"}! I'd love to connect...`}
          rows={3}
          className="mt-1.5 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 text-sm leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-3 focus:ring-[var(--accent)]/15"
        />
        <div className="mt-1 flex items-center justify-between px-1">
          <span className="text-[11px] text-[var(--text-muted)]">
            Shown to them before they accept — keep it friendly
          </span>
          <span className={`text-[11px] ${welcomeMessage.length > 260 ? "text-amber-600" : "text-[var(--text-muted)]"}`}>
            {welcomeMessage.length}/280
          </span>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <button
          type="button"
          disabled={busyMode != null}
          onClick={() => handleSend(true)}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-[13px] font-semibold transition-all ${
            hasMessage
              ? "bg-[var(--accent)] text-[var(--on-accent)] hover:opacity-90"
              : "bg-[var(--accent)]/60 text-[var(--on-accent)] opacity-60 cursor-not-allowed"
          } disabled:opacity-40`}
          title={hasMessage ? "Send with welcome message" : "Write a message first"}
        >
          {busyMode === "with" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send with welcome message
        </button>
        <button
          type="button"
          disabled={busyMode != null}
          onClick={() => handleSend(false)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-[13px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--hover)] disabled:opacity-40"
        >
          {busyMode === "without" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Send without message
        </button>
        <p className="text-center text-[11px] text-[var(--text-muted)]">
          Private — only they see your welcome message before accepting
        </p>
      </div>
    </>
  );

  const header = (
    <div className="flex items-center justify-between">
      <h3 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">Send friend request</h3>
      <button type="button" onClick={onClose} aria-label="Close" className="flex size-8 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover)]">
        <X className="h-4 w-4" />
      </button>
    </div>
  );

  if (!isDesktop) {
    return (
      <div className="fixed inset-0 z-[60] flex items-end justify-center">
        <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Send friend request"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={reduce ? { duration: 0 } : { duration: 0.28, ease: EASE }}
          className="relative z-10 flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] pb-[max(env(safe-area-inset-bottom),1rem)]"
        >
          <div className="mx-auto mt-3 h-1.5 w-9 shrink-0 rounded-full bg-[var(--border)]" />
          <div className="border-b border-[var(--border)] px-5 py-3.5">{header}</div>
          <div className="overflow-y-auto px-5 py-4">{content}</div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8">
      <button type="button" aria-label="Close" onClick={onClose} className={`t-modal-backdrop absolute inset-0 bg-black/50 backdrop-blur-sm ${show ? "is-open" : ""}`} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Send friend request"
        className={`t-modal relative z-10 flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] ${show ? "is-open" : "is-closing"}`}
      >
        <div className="border-b border-[var(--border)] px-6 py-4">{header}</div>
        <div className="overflow-y-auto px-6 py-5">{content}</div>
      </div>
    </div>
  );
}

export default SendRequestModal;
