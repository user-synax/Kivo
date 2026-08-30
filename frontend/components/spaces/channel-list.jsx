"use client";
import { Hash, Megaphone, Plus } from "lucide-react";
import { canCreateChannel } from "@/lib/spaces";

export function ChannelList({ space, channels, selectedChannelId, onSelectChannel, onCreateChannel, currentRole }) {
  const canCreate = canCreateChannel(currentRole);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Channels</span>
        {canCreate && (
          <button type="button" onClick={onCreateChannel} aria-label="Create channel" className="flex size-6 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]">
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto px-2">
        {(channels || []).map((ch) => {
          const active = ch.id === selectedChannelId;
          const Icon = ch.type === "announcement" ? Megaphone : Hash;
          return (
            <button key={ch.id} type="button" onClick={() => onSelectChannel(ch.id)} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors ${active ? "bg-[var(--accent-soft)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"}`}>
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{ch.name}</span>
            </button>
          );
        })}
        {(channels || []).length === 0 && <p className="px-2 py-6 text-center text-[12px] text-[var(--text-muted)]">No channels yet</p>}
      </div>
    </div>
  );
}
export default ChannelList;
