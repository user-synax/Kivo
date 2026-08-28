"use client";

import { motion, useReducedMotion } from "motion/react";

const EASE_SMOOTH_OUT = [0.22, 1, 0.36, 1];

export function AuthCard({ children }) {
  const reduce = useReducedMotion();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-void-black px-4 py-12">
      {/* subtle radial glow — carries the brand accent without competing */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime-pulse/[0.06] blur-[90px]" />
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE_SMOOTH_OUT }}
        className="relative w-full max-w-[420px]"
      >
        {/* Logo */}
        <a
          href="/"
          className="mb-8 flex items-center justify-center gap-2 rounded-pills px-2 text-phosphor-white transition-opacity duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:opacity-80"
          aria-label="Kivo home"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 22 22"
            aria-hidden="true"
            className="shrink-0"
          >
            <rect x="1" y="1" width="20" height="20" rx="6" fill="#7fee64" />
            <rect x="6.5" y="6.5" width="9" height="9" rx="2.5" fill="#181818" />
          </svg>
          <span className="font-goga text-[22px] font-medium tracking-tight text-phosphor-white">
            Kivo
          </span>
        </a>

        {/* Card */}
        <div className="rounded-xl border border-circuit-border/60 bg-ground-iron p-8 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] sm:p-10">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

export default AuthCard;
