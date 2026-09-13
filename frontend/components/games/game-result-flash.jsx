"use client";

import { useEffect, useRef } from "react";
import { playGameResult } from "@/lib/sound";

// Kivo Games — the one-second "Game finished" flash.
//
// A full-screen wash of colour (green for a win, red for a loss) plus a
// synthesised stinger, shown the instant a race ends and then gone. The whole
// thing is aria-live so screen readers announce the outcome, and keeps
// `motion-reduce` in mind by falling back to a plain fade. Tapping dismisses it
// early instead of making the user wait out the animation.

export const GAME_FLASH_MS = 1200;

const KEYFRAMES = `@keyframes kivo-game-flash-wash {
  0% { opacity: 0; }
  10% { opacity: 1; }
  82% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes kivo-game-flash-burst {
  0% { opacity: 0; transform: scale(0.8); }
  55% { opacity: 1; transform: scale(1.07); }
  100% { opacity: 1; transform: scale(1); }
}`;

const OUTCOMES = {
  win: {
    headline: "You Win",
    emoji: "\u{1F3C6}",
    // A saturated green, deliberately brighter than the app's own success
    // colour so the flash reads as an event rather than a UI state.
    wash: "bg-[#12b886]",
    glow: "radial-gradient(circle at 50% 42%, rgba(255,255,255,0.42), transparent 62%)",
  },
  lose: {
    headline: "You Lose",
    emoji: "\u{1F494}",
    wash: "bg-[#e03131]",
    glow: "radial-gradient(circle at 50% 42%, rgba(255,255,255,0.34), transparent 62%)",
  },
};

export function GameResultFlash({ outcome, onDone, subtitle }) {
  const meta = OUTCOMES[outcome] || OUTCOMES.lose;
  // Held in a ref so an inline `onDone` from the parent cannot re-run the effect
  // and replay the stinger mid-flash.
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    playGameResult(outcome === "win" ? "win" : "lose");
    const timer = setTimeout(() => doneRef.current?.(), GAME_FLASH_MS);
    return () => clearTimeout(timer);
  }, [outcome]);

  return (
    <button
      type="button"
      onClick={() => doneRef.current?.()}
      aria-label={`Game finished — ${meta.headline}. Tap to dismiss.`}
      // The wash is animated inline rather than through a Tailwind arbitrary
      // animation class: Tailwind's scanner cannot extract a class built from an
      // interpolated value, and opacity-only fades are safe under reduced motion.
      style={{
        animation: `kivo-game-flash-wash ${GAME_FLASH_MS}ms ease-out both`,
      }}
      className={`fixed inset-0 z-[120] flex cursor-pointer flex-col items-center justify-center gap-3 border-0 text-white ${meta.wash}`}
    >
      <style>{KEYFRAMES}</style>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: meta.glow }}
      />
      <span
        aria-live="assertive"
        className="pointer-events-none relative flex flex-col items-center gap-3 px-6 text-center animate-[kivo-game-flash-burst_320ms_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none"
      >
        <span className="text-[52px] leading-none drop-shadow-lg md:text-[68px]">
          {meta.emoji}
        </span>
        <span className="text-[13px] font-semibold uppercase tracking-[0.22em] text-white/85">
          Game finished
        </span>
        <span className="text-[38px] font-extrabold leading-none tracking-tight drop-shadow-md md:text-[52px]">
          {meta.headline}
        </span>
        {subtitle && (
          <span className="text-[13px] font-medium text-white/90">
            {subtitle}
          </span>
        )}
      </span>
    </button>
  );
}

export default GameResultFlash;
