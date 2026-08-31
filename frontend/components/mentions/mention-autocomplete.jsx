"use client";

import { motion } from "motion/react";
import { Avatar } from "@/components/dashboard/avatar";
import { participantAvatarName, participantName } from "@/lib/chat";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1];

export function MentionAutocomplete({
  participants = [],
  query = "",
  selectedIndex = 0,
  onSelect,
}) {
  const filtered = participants.filter((p) => {
    if (!p) return false;
    const username = p.username || "";
    const displayName = p.displayName || "";
    const q = query.toLowerCase();
    return (
      username.toLowerCase().startsWith(q) ||
      displayName.toLowerCase().startsWith(q)
    );
  });

  if (filtered.length === 0) return null;

  return (
    <motion.div
      id="kivo-mention-autocomplete"
      initial={{ opacity: 0, scale: 0.96, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 6 }}
      transition={{ duration: 0.16, ease: EASE }}
      className="absolute bottom-[calc(100%+8px)] left-0 z-50 max-h-56 min-w-[260px] max-w-[320px] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-1.5 shadow-2xl backdrop-blur-xl"
    >
      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Mention Member
      </div>
      {filtered.map((p, index) => {
        const isSelected = index === selectedIndex;
        const name = participantName(p);
        const avatarName = participantAvatarName(p);
        const username = p.username ? `@${p.username}` : "";

        return (
          <button
            key={p.id || p._id || index}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault(); // keep textarea focus
              onSelect?.(p);
            }}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-xs transition-colors",
              isSelected
                ? "bg-[var(--accent)]/15 text-[var(--accent)] font-medium"
                : "text-[var(--text-primary)] hover:bg-[var(--hover)]",
            )}
          >
            <Avatar
              name={avatarName}
              avatarStyle={p.avatarStyle}
              url={p.avatarUrl}
              size="sm"
            />
            <div className="min-w-0 flex-1 truncate">
              <span className="font-medium text-current">
                {name}
              </span>
              {username && (
                <span className={cn("ml-1.5 text-[11px]", isSelected ? "text-[var(--accent)]/80" : "text-[var(--text-muted)]")}>
                  {username}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </motion.div>
  );
}

export default MentionAutocomplete;
