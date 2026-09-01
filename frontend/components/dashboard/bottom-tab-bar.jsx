"use client";

import { Layers, MessageCircle, User } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "chats", label: "Chats", icon: MessageCircle },
  { id: "spaces", label: "Spaces", icon: Layers },
  { id: "profile", label: "Profile", icon: User },
];

const EASE = [0.22, 1, 0.36, 1];

export function BottomTabBar({ active, onChange }) {
  const reduce = useReducedMotion();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 flex shrink-0 items-center justify-around gap-1 border-t border-[var(--border)] bg-[var(--bg-elevated)]/95 px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur-xl supports-[backdrop-filter]:bg-[var(--bg-elevated)]/80"
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            aria-current={isActive ? "page" : undefined}
            aria-label={tab.label}
            onClick={() => onChange?.(tab.id)}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-medium transition-colors duration-200",
              isActive
                ? "text-[#a3e635]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            )}
          >
            {isActive && (
              <motion.span
                layoutId="mobile-tab-pill"
                aria-hidden="true"
                className="absolute inset-0 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-sm"
                transition={reduce ? { duration: 0 } : { duration: 0.28, ease: EASE }}
              />
            )}
            <Icon
              className={cn(
                "relative z-10 h-5 w-5 transition-colors",
                isActive ? "text-[#a3e635]" : "text-[var(--text-muted)]"
              )}
              strokeWidth={isActive ? 2.2 : 1.8}
            />
            <span className={cn("relative z-10", isActive ? "text-[#a3e635]" : "")}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default BottomTabBar;
