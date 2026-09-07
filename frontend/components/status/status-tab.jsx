"use client";
import { useMemo } from "react";
import { StatusRing } from "./status-ring";
import { formatDistanceToNow } from "date-fns";

export function StatusTab({ myStatuses, feed, currentUser, onCreate, onViewUser, onViewMy, uploading=false }) {
  const hasMy = Array.isArray(myStatuses) && myStatuses.length > 0;
  const lastMy = hasMy ? myStatuses[myStatuses.length-1] : null;
  const viewedLabel = (s) => s?.createdAt ? formatDistanceToNow(new Date(s.createdAt), { addSuffix: true }) : "";
  const labelFor = (s)=>{
    if(!s) return "";
    if(s.media?.kind === "image") return `Photo${s.text? ": "+s.text.slice(0,20):""} • ${viewedLabel(s)}`;
    return viewedLabel(s);
  };

  return (
    <div className="flex h-full min-w-0 flex-col bg-[var(--bg-elevated)] pt-[max(env(safe-area-inset-top),1rem)]">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
        <span className="font-display text-3xl font-semibold tracking-tight text-[var(--text-primary)]">Status</span>
        <button type="button" onClick={onCreate} className="rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--on-accent)] hover:opacity-90">+ New</button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {/* My Status row — top as requested */}
        <button type="button" onClick={() => hasMy ? onViewMy?.() : onCreate?.()} disabled={uploading} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[var(--hover)] disabled:opacity-60">
          <StatusRing name={currentUser?.displayName||currentUser?.username} url={currentUser?.avatarUrl} avatarStyle={currentUser?.avatarStyle} isPlus={false} hasUnseen={hasMy ? myStatuses.some(s=>false) : undefined} isMine={!hasMy} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">My status</p>
            <p className="truncate text-[12px] text-[var(--text-muted)]">{uploading ? "Uploading…" : hasMy ? `${myStatuses.length} update${myStatuses.length>1?'s':''} • ${labelFor(lastMy)}` : "Tap to add status update"}</p>
          </div>
          {uploading && <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" aria-hidden="true" />}
        </button>
        {uploading && (
          <div className="mx-3 mt-1 h-1 overflow-hidden rounded-full bg-[var(--border)]">
            <div className="h-full w-full animate-pulse bg-[var(--accent)]" />
          </div>
        )}

        <div className="my-2 h-px bg-[var(--border)]" />

        {(!feed || feed.length===0) ? (
          <p className="px-3 py-6 text-center text-[13px] text-[var(--text-muted)]">No status updates from friends yet. When friends post, they'll appear here.</p>
        ) : (
          <div className="space-y-0.5">
            <p className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Recent updates</p>
            {feed.map((group) => {
              const unseen = group.statuses.some(s=>!s.isViewed);
              const latest = group.statuses[0];
              return (
                <button key={group.user._id || group.user.id} type="button" onClick={()=>onViewUser?.(group)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[var(--hover)]">
                  <StatusRing name={group.user.displayName||group.user.username} url={group.user.avatarUrl} avatarStyle={group.user.avatarStyle} hasUnseen={unseen} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{group.user.displayName||group.user.username}</p>
                    <p className="truncate text-[12px] text-[var(--text-muted)]">{labelFor(latest)}</p>
                  </div>
                  {unseen && <span className="size-2 shrink-0 rounded-full bg-[#25D366]" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
