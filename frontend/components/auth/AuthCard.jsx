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
          <img
            src="/icons/icon-192.png"
            alt="Kivo"
            width="40"
            height="40"
            className="size-10 shrink-0 rounded-[10px] object-cover"
          />
          <span className="font-goga text-[22px] font-medium tracking-tight text-ink-black">
            Kivo
          </span>
        </a>

        {/* Card */}
        <div className="rounded-cards border border-hairline/70 bg-fog p-8 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.6)] sm:p-10">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

export default AuthCard;
