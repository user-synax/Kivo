"use client";
import { Users, Hash } from "lucide-react";
import { Avatar } from "@/components/dashboard/avatar";

export function SpaceCard({ space, onClick, onJoin, actionLabel }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] text-left transition-colors hover:bg-[var(--hover)]">
      <div className="h-16 w-full overflow-hidden bg-gradient-to-br from-[var(--accent)]/20 to-[#6a4cf5]/20">
        {space.banner ? <img src={space.banner} alt="" aria-hidden="true" className="h-full w-full object-cover" /> : null}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="-mt-8 flex items-end gap-3">
          <div className="rounded-xl border-2 border-[var(--bg-surface)] bg-[var(--bg-surface)]">
            <Avatar name={space.name} url={space.avatarUrl} size="lg" />
          </div>
          <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)] border border-[var(--border)]">{space.category}</span>
        </div>
        <h3 className="mt-3 truncate text-sm font-semibold text-[var(--text-primary)]">{space.name}</h3>
        <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-[12px] text-[var(--text-muted)]">{space.description || "No description"}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]"><Users className="h-3.5 w-3.5" /> {space.memberCount} members <Hash className="h-3 w-3 ml-1" /> {space.channelCount}</span>
          {onJoin && <span onClick={(e)=>{e.stopPropagation(); onJoin();}} className="rounded-full bg-[var(--accent)] px-3 py-1 text-[12px] font-medium text-[var(--on-accent)]">{actionLabel || "View"}</span>}
        </div>
      </div>
    </button>
  );
}
export default SpaceCard;
