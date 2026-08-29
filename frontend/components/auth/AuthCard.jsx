"use client";

import { motion, useReducedMotion } from "motion/react";

const EASE_SMOOTH_OUT = [0.22, 1, 0.36, 1];

export function AuthCard({ children }) {
  const reduce = useReducedMotion();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-warm-canvas px-4 py-12">
      {/* subtle radial glow — carries the brand accent without competing */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-eclipse-violet/[0.08] blur-[90px]" />
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE_SMOOTH_OUT }}
        className="relative w-full max-w-[440px]"
      >
        {/* Logo */}
        <a
          href="/"
          className="mb-8 flex items-center justify-center gap-2 rounded-pills px-2 text-ink-black transition-opacity duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:opacity-80"
          aria-label="Kivo home"
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="shrink-0"
          >
            <defs>
              <linearGradient id="kivoAuthMark" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#7a40ed" />
                <stop offset="100%" stopColor="#17082c" />
              </linearGradient>
            </defs>
            <rect x="1" y="1" width="22" height="22" rx="7" fill="url(#kivoAuthMark)" />
            <path
              d="M7 9.2A1.6 1.6 0 0 1 8.6 7.6h6.8A1.6 1.6 0 0 1 17 9.2v4.1a1.6 1.6 0 0 1-1.6 1.6H10l-2.6 2.2v-2.2H8.6A1.6 1.6 0 0 1 7 13.3V9.2Z"
              fill="#ffffff"
            />
          </svg>
          <span className="font-goga text-[22px] font-medium tracking-tight text-ink-black">
            Kivo
          </span>
        </a>

        {/* Card */}
        <div className="rounded-cards border border-stone/70 bg-pure-white p-8 shadow-[0_40px_90px_-30px_rgba(25,23,28,0.28)] sm:p-10">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

export default AuthCard;
