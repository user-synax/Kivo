"use client";

import { MapPin, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import { NearbyTab } from "@/components/dashboard/nearby-tab";

export function NearbyScreen({ onClose }) {
  const reduce = useReducedMotion();

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Nearby users"
      className="fixed inset-0 z-50 flex h-[100dvh] flex-col overflow-hidden bg-[var(--bg-base)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reduce ? { duration: 0 } : { duration: 0.18 }}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-3 pb-2.5 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur-xl supports-[backdrop-filter]:bg-[var(--bg-elevated)]/85 md:px-5 md:pt-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white">
          <MapPin className="h-4 w-4" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-semibold leading-tight text-[var(--text-primary)]">
            Nearby users
          </h1>
          <p className="hidden truncate text-[11px] leading-tight text-[var(--text-muted)] sm:block">
            Discover people near you — distance only, never exact location
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close nearby"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
        >
          <X className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>

      {/* Body */}
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y"
        style={{ overscrollBehavior: "contain" }}
      >
        <div className="mx-auto w-full max-w-6xl px-3 py-4 md:px-6 md:py-6">
          <NearbyTab
            onStartChat={() => {}}
            onViewProfile={(u) => u.username && window.open(`/u/${u.username}`, "_blank")}
          />
        </div>
      </div>
    </motion.div>
  );
}

export default NearbyScreen;
