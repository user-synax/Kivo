"use client";
import { useMemo } from "react";
import { StatusRing } from "./status-ring";
import { formatDistanceToNow } from "date-fns";

export function StatusTab({ myStatuses, feed, currentUser, onCreate, onViewUser, onViewMy }) {
  const hasMy = Array.isArray(myStatuses) && myStatuses.length > 0;
  const lastMy = hasMy ? myStatuses[myStatuses.length-1] : null;
  const viewedLabel = (s) => s?.createdAt ? formatDistanceToNow(new Date(s.createdAt), { addSuffix: true }) : "";

  return (
    <div className="flex h-full min-w-0 flex-col bg-[var(--bg-elevated)] pt-[max(env(safe-area-inset-top),1rem)]">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
        <span className="font-display text-3xl font-semibold tracking-tight text-[var(--text-primary)]">Status</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {/* My Status row — top as requested */}
        <button type="button" onClick={() => hasMy ? onViewMy?.() : onCreate?.()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[var(--hover)]">
          <StatusRing name={currentUser?.displayName||currentUser?.username} url={currentUser?.avatarUrl} avatarStyle={currentUser?.avatarStyle} isPlus={false} hasUnseen={hasMy ? myStatuses.some(s=>false) : undefined} isMine={!hasMy} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">My status</p>
            <p className="truncate text-[12px] text-[var(--text-muted)]">{hasMy ? `${myStatuses.length} update${myStatuses.length>1?'s':''} • ${viewedLabel(lastMy)}` : "Tap to add status update"}</p>
          </div>
        </button>

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
                    <p className="truncate text-[12px] text-[var(--text-muted)]">{viewedLabel(latest)}</p>
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
