"use client";

import { MapPin, MessageCircle, UserPlus, Check, Loader2, ShieldCheck, BadgeCheck, Mail } from "lucide-react";
import { Avatar } from "@/components/dashboard/avatar";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { formatDistance } from "@/lib/location";

// Square responsive profile preview card — used for Find Friend + Nearby
// Modern, polished, responsive, fast (no heavy images, motion-light)

export function ProfilePreviewCard({
  user,
  relationship = "none",
  distanceLabel,
  distanceMeters,
  busy = false,
  onAdd,
  onMessage,
  onViewProfile,
  compact = false,
}) {
  const fullName = user.displayName || user.username || user.email || "Unknown";
  const handle = user.username ? `@${user.username}` : user.email || "";
  const isFriends = relationship === "friends";
  const isOutgoing = relationship === "outgoing";
  const isIncoming = relationship === "incoming";
  const label = distanceLabel || (distanceMeters != null ? formatDistance(distanceMeters) : null);

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] transition-all duration-200 hover:border-[var(--accent)]/30 hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)] ${compact ? "p-3" : "p-4"}`}
    >
      {/* Banner accent — thin top wash using avatar/banner if present */}
      <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-br from-[var(--accent)]/12 via-[var(--accent)]/6 to-transparent pointer-events-none" />
      {/* Optional banner image wash */}
      {user.banner && (
        <div
          className="absolute inset-x-0 top-0 h-14 opacity-[0.18] pointer-events-none"
          style={{
            backgroundImage: `url(${user.banner})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
          aria-hidden="true"
        />
      )}

      <div className="relative flex flex-col items-center text-center">
        {/* Avatar — centered, with Plus border and verified badge */}
        <div className="relative">
          <Avatar
            name={fullName}
            avatarStyle={user.avatarStyle}
            url={user.avatarUrl}
            size={compact ? "md" : "lg"}
            isPlus={Boolean(user.isPlus)}
          />
          {user.verified && user.showBadge !== false && (
            <span className="absolute -bottom-1 -right-1 rounded-full bg-[var(--bg-surface)] p-0.5">
              <VerifiedBadge size="sm" decorative />
            </span>
          )}
        </div>

        <div className="mt-3 w-full min-w-0">
          <p className="truncate text-[14px] font-semibold leading-tight text-[var(--text-primary)] flex items-center justify-center gap-1">
            <span className="truncate">{fullName}</span>
            {user.googleVerified || user.githubVerified ? (
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#0ea5e9]" />
            ) : null}
          </p>
          {handle && (
            <p className="truncate text-[12px] text-[var(--text-muted)] flex items-center justify-center gap-1">
              <span className="truncate">{handle}</span>
              {user.country && (
                <img
                  src={`https://flagcdn.com/w20/${String(user.country).toLowerCase()}.png`}
                  alt={user.country}
                  className="h-3 w-3 shrink-0 rounded-full object-cover"
                  loading="lazy"
                />
              )}
            </p>
          )}
        </div>

        {/* Status / bio — clamped */}
        {(user.status || user.bio) && (
          <div className="mt-2 w-full min-w-0 space-y-1">
            {user.status && (
              <p className="flex items-center justify-center gap-1 truncate px-2 text-[12px] italic text-[var(--text-muted)]">
                {user.statusEmoji && (
                  <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-[11px]">
                    {user.statusEmoji}
                  </span>
                )}
                <span className="truncate">“{user.status}”</span>
              </p>
            )}
            {user.bio && (
              <p className="line-clamp-2 px-2 text-[12px] leading-snug text-[var(--text-muted)]/80">
                {user.bio}
              </p>
            )}
          </div>
        )}

        {/* Distance chip — only for nearby */}
        {label && (
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[var(--accent)]/10 px-2.5 py-1 text-[11px] font-medium text-[var(--accent)]">
            <MapPin className="h-3 w-3" />
            {label}
          </span>
        )}

        {/* Verified + country row already handled; add subtle meta */}
        {user.isPlus && (
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
            <ShieldCheck className="h-3 w-3" /> PLUS
          </span>
        )}
      </div>

      {/* Actions — sticky bottom */}
      <div className="mt-3 flex w-full flex-col gap-1.5">
        {isFriends ? (
          <button
            type="button"
            onClick={() => onMessage?.(user)}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-[12px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--hover)]"
          >
            <MessageCircle className="h-3.5 w-3.5" /> Message
          </button>
        ) : isOutgoing ? (
          <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-[12px] text-[var(--text-muted)]">
            <Check className="h-3.5 w-3.5" /> Requested
          </span>
        ) : isIncoming ? (
          <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[12px] font-medium text-amber-700">
            <Mail className="h-3.5 w-3.5" /> Wants to be friends
          </span>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => onAdd?.(user)}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-2 text-[12px] font-semibold text-[var(--on-accent)] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
            Send Request
          </button>
        )}

        {onViewProfile && (
          <button
            type="button"
            onClick={() => onViewProfile?.(user)}
            className="w-full rounded-full px-3 py-1.5 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover)] transition-colors"
          >
            View profile
          </button>
        )}
      </div>
    </div>
  );
}

export default ProfilePreviewCard;
