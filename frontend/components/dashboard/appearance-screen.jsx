"use client";

import { X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { ChatStyleSection, ThemeStudio } from "./settings-panel";

// Appearance is its own full-screen page now (it used to be a card inside
// Settings). It owns base theme, the color studio, and the personal chat look
// (wallpaper + bubble style), laid out wide so every control is editable
// without the cramped settings column. Opened from the Settings column on
// desktop and from the mobile Menu.
function PageCard({ children, className }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

function BaseThemeCard() {
  const { themeId, themes, setThemeId } = useTheme();
  return (
    <PageCard>
      <div className="mb-2">
        <p className="text-[12px] font-semibold text-[var(--text-primary)]">
          Base theme
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-muted)]">
          The preset canvas &amp; ink family. Your studio colors and chat look
          layer on top of it.
        </p>
      </div>
      <div className="space-y-1">
        {themes.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setThemeId(t.id)}
            aria-pressed={t.id === themeId}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] transition-colors duration-150 hover:bg-[var(--hover)]",
              t.id === themeId
                ? "text-[var(--text-primary)]"
                : "text-[var(--text-muted)]",
            )}
          >
            <span
              className="size-4 shrink-0 rounded-full ring-1 ring-[var(--border)]"
              style={{ background: t.swatch }}
            />
            <span className="flex-1 truncate">{t.label}</span>
            {t.id === themeId && (
              <span className="size-2 shrink-0 rounded-full bg-[var(--accent)]" />
            )}
          </button>
        ))}
      </div>
    </PageCard>
  );
}

export function AppearanceScreen({ onClose }) {
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
      aria-label="Appearance"
      className="fixed inset-0 z-50 flex h-[100dvh] flex-col overflow-hidden bg-[var(--bg-base)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reduce ? { duration: 0 } : { duration: 0.18 }}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-3 pb-2.5 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur-xl supports-[backdrop-filter]:bg-[var(--bg-elevated)]/85 md:px-5 md:pt-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-semibold leading-tight text-[var(--text-primary)]">
            Appearance
          </h1>
          <p className="hidden truncate text-[11px] leading-tight text-[var(--text-muted)] sm:block">
            Base theme · your colors · chat wallpaper &amp; bubble style
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close appearance"
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
          <div className="grid items-start gap-3 lg:grid-cols-2 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-3">
              <BaseThemeCard />
              <PageCard>
                <ThemeStudio />
              </PageCard>
            </div>
            <div className="space-y-3">
              <PageCard>
                <ChatStyleSection />
              </PageCard>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default AppearanceScreen;
