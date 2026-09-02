"use client";

import { Layers, MessageCircle, Settings } from "lucide-react";
import { Avatar } from "@/components/dashboard/avatar";
import { cn } from "@/lib/utils";

const RAIL_ITEMS = [
  { id: "chats", label: "Chats", icon: MessageCircle },
  { id: "spaces", label: "Spaces", icon: Layers },
  { id: "settings", label: "Settings", icon: Settings },
];

export function IconRail({ activeTab, onTabChange, currentUser, onProfileClick }) {
  const profileLabel = currentUser?.displayName || currentUser?.email || "Profile";

  return (
    <nav
      aria-label="Primary"
      className="flex h-full w-[64px] shrink-0 flex-col items-center border-r border-[var(--border)] bg-[var(--bg-elevated)] py-3"
    >
      <div className="flex w-full flex-col items-center gap-1">
        {RAIL_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <div key={item.id} className="group relative flex w-full justify-center">
              <button
                type="button"
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                onClick={() => onTabChange?.(item.id)}
                className={cn(
                  "flex size-10 items-center justify-center rounded-xl transition-colors duration-200",
                  isActive
                    ? "text-[var(--accent)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.2 : 1.8} />
              </button>
              {/* hover tooltip — icons only in rail, label on hover */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-xs font-medium text-[var(--text-primary)] opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                role="tooltip"
              >
                {item.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-auto flex w-full flex-col items-center gap-2 pt-3">
        <div className="h-px w-8 bg-[var(--border)]" aria-hidden="true" />
        <div className="group relative flex justify-center">
          <button
            type="button"
            aria-label="Profile"
            onClick={onProfileClick}
            className="flex size-10 items-center justify-center rounded-xl transition-colors duration-200 hover:bg-[var(--hover)]"
          >
            <Avatar
              name={profileLabel}
              avatarStyle={currentUser?.avatarStyle}
              url={currentUser?.avatarUrl}
              size="sm"
            />
          </button>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-xs font-medium text-[var(--text-primary)] opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
            role="tooltip"
          >
            Profile
          </span>
        </div>
      </div>
    </nav>
  );
}

export default IconRail;
