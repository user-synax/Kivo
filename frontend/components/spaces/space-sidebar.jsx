"use client";
import { Plus } from "lucide-react";
import { Avatar } from "@/components/dashboard/avatar";
import { ChannelList } from "./channel-list";

export function SpaceSidebar({ spaces, selectedSpaceId, onSelectSpace, onCreateSpace, channelProps }) {
  const selected = spaces?.find((s) => s.id === selectedSpaceId) || null;
  return (
    <div className="flex h-full">
      <div className="flex w-16 shrink-0 flex-col items-center gap-2 border-r border-[var(--border)] bg-[var(--bg-elevated)] py-3">
        {spaces?.map((s) => {
          const active = s.id === selectedSpaceId;
          return (
            <button key={s.id} type="button" onClick={() => onSelectSpace(s.id)} aria-label={s.name} className={`relative flex size-11 items-center justify-center rounded-xl transition-all ${active ? "ring-2 ring-[var(--accent)] bg-[var(--bg-surface)]" : "hover:bg-[var(--hover)] opacity-80 hover:opacity-100"}`}>
              <Avatar name={s.name} url={s.avatarUrl} size="sm" />
              {active && <span className="absolute -left-1 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-[var(--accent)]" />}
            </button>
          );
        })}
        <button type="button" onClick={onCreateSpace} aria-label="Create space" className="flex size-11 items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]">
          <Plus className="h-5 w-5" />
        </button>
      </div>
      <div className="flex w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)]">
        {selected ? (
          <ChannelList space={selected} {...channelProps} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
            <p className="text-sm font-medium text-[var(--text-primary)]">No space selected</p>
            <p className="mt-1 text-[12px] text-[var(--text-muted)]">Pick a space or create one</p>
            <button type="button" onClick={onCreateSpace} className="mt-4 rounded-full bg-[var(--accent)] px-4 py-2 text-[12px] font-medium text-[var(--on-accent)]">Create Space</button>
          </div>
        )}
      </div>
    </div>
  );
}
export default SpaceSidebar;
