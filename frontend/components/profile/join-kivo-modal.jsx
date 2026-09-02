"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1];

/* ── Container / item stagger ────────────────────────────────────────────── */
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 8, filter: "blur(3px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.4, ease: EASE },
  },
};

/* ── JoinKivoModal ─────────────────────────────────────────────────────────
   Centered modal inviting non-logged-in visitors to join Kivo.
   Renders nothing when `open` is false (AnimatePresence handles exit).
   ──────────────────────────────────────────────────────────────────────── */
export function JoinKivoModal({ open, onClose }) {
  const reduce = useReducedMotion();

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — t-modal-backdrop pattern */}
          <motion.div
            key="jk-backdrop"
            initial={reduce ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0 }}
            transition={
              reduce ? { duration: 0 } : { duration: 0.25, ease: EASE }
            }
            onClick={onClose}
            aria-hidden="true"
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px]"
          />

          {/* Dialog — centered, responsive */}
          <div className="fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              key="jk-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Join Kivo"
              initial={
                reduce
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.95, y: 12, filter: "blur(4px)" }
              }
              animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
              exit={
                reduce
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.97, y: 8, filter: "blur(2px)" }
              }
              transition={
                reduce
                  ? { duration: 0 }
                  : { duration: 0.3, ease: EASE }
              }
              className="pointer-events-auto w-full max-w-[420px] overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] shadow-[var(--shadow-xl)]"
            >
              {/* Close */}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors duration-200 hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Content */}
              <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="flex flex-col items-center px-6 pt-8 pb-7 text-center sm:px-8"
              >
                {/* Logo */}
                <motion.div variants={item} className="mb-5">
                  <img
                    src="/icons/icon-192.png"
                    alt="Kivo"
                    width={48}
                    height={48}
                    className="h-12 w-12 rounded-[12px] object-cover"
                  />
                </motion.div>

                {/* Heading */}
                <motion.h2
                  variants={item}
                  className="font-display text-[22px] font-semibold tracking-tight text-[var(--ink)] sm:text-[24px]"
                >
                  Join Kivo
                </motion.h2>

                <motion.p
                  variants={item}
                  className="mt-2 max-w-[300px] text-[14px] leading-relaxed text-[var(--ink-muted)]"
                >
                  Create an account to message, add friends, and chat in real
                  time.
                </motion.p>

                {/* Actions */}
                <motion.div
                  variants={item}
                  className="mt-6 flex w-full flex-col gap-2.5"
                >
                  <a
                    href="/signup"
                    className={cn(
                      "inline-flex h-11 items-center justify-center rounded-full px-6 text-[14px] font-medium",
                      "bg-[var(--ink)] text-[var(--inverse-ink)]",
                      "transition-[filter,transform] duration-200",
                      "hover:brightness-95 active:scale-[0.98]",
                    )}
                  >
                    Sign up
                  </a>
                  <a
                    href="/login"
                    className={cn(
                      "inline-flex h-11 items-center justify-center rounded-full px-6 text-[14px] font-medium",
                      "border border-[var(--hairline)] text-[var(--ink-muted)]",
                      "transition-colors duration-200",
                      "hover:bg-[var(--surface-2)] hover:text-[var(--ink)]",
                    )}
                  >
                    Log in
                  </a>
                </motion.div>

                {/* Dismiss */}
                <motion.button
                  variants={item}
                  type="button"
                  onClick={onClose}
                  className="mt-4 text-[12px] text-[var(--ink-muted)]/60 transition-colors duration-200 hover:text-[var(--ink-muted)]"
                >
                  Just browsing
                </motion.button>
              </motion.div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

export default JoinKivoModal;
