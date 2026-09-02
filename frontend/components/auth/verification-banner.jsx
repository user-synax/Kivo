"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { apiPost } from "@/lib/api";

const EASE_SMOOTH_OUT = [0.22, 1, 0.36, 1];
const DISMISS_KEY = "kivo:email-banner-dismissed";

export function VerificationBanner({ user }) {
  const reduce = useReducedMotion();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  });
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  // Don't show for verified users
  if (!user || user.isEmailVerified) return null;
  if (dismissed) return null;

  async function handleResend() {
    if (resent || resending) return;
    setResending(true);
    try {
      await apiPost("/api/v1/auth/resend-verification");
      setResent(true);
    } catch {
      // Silently ignore errors to avoid alarming the user
    } finally {
      setResending(false);
    }
  }

  function handleDismiss() {
    setDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(DISMISS_KEY, "1");
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={reduce ? false : { opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.3, ease: EASE_SMOOTH_OUT }}
        className="flex items-center gap-3 border-b border-amber-400/20 bg-amber-400/[0.08] px-4 py-2.5 text-[13px]"
      >
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="size-4 shrink-0 text-amber-500"
        >
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
        <span className="flex-1 text-[var(--text-primary)]">
          Please verify your email to access all features.
        </span>
        {!resent ? (
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="shrink-0 rounded-md px-2 py-1 text-[12px] font-medium text-amber-600 transition-colors hover:bg-amber-400/10 disabled:opacity-50"
          >
            {resending ? "Sending…" : "Resend link"}
          </button>
        ) : (
          <span className="shrink-0 text-[12px] font-medium text-green-600">
            Sent!
          </span>
        )}
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded-md p-1 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
          aria-label="Dismiss"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="size-3.5">
            <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
          </svg>
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
