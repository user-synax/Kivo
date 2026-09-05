"use client";

import { Phone, PhoneMissed, PhoneOff, Video } from "lucide-react";
import { Avatar } from "@/components/dashboard/avatar";
import { formatTime } from "@/lib/chat";
import { cn } from "@/lib/utils";
import { useCalls } from "./call-provider";

// Structured call-history payload carried by plain system messages (no schema
// change): 📞CALL:<event>:<kind>:<durationSec>:<actorName>
const CHIP_PREFIX = "📞CALL:";
const CHIP_EVENTS = new Set([
  "started",
  "cancelled",
  "declined",
  "missed",
  "ended",
]);

export function parseCallChip(content) {
  if (typeof content !== "string" || !content.startsWith(CHIP_PREFIX))
    return null;
  const parts = content.slice(CHIP_PREFIX.length).split(":");
  if (parts.length < 3) return null;
  const [event, kind, duration, ...actorParts] = parts;
  if (!CHIP_EVENTS.has(event)) return null;
  return {
    event,
    kind: kind === "video" ? "video" : "voice",
    durationSec: Math.max(0, Math.floor(Number(duration) || 0)),
    actorName: actorParts.join(":") || null,
  };
}

export function formatChipDuration(totalSec) {
  const s = Math.max(0, Math.floor(Number(totalSec) || 0));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  const hh = Math.floor(s / 3600);
  return hh > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Rich centered card for a call-history chip: icon, who + what + how long,
// timestamp, and a one-tap Call back button (missed / declined / ended /
// cancelled). Falls back gracefully when opened without a call context.
export function CallChip({ message, call }) {
  const calls = useCalls() || {};
  const { meId, session, outgoing, incoming, startCall, resolveConv } = calls;
  const parsed = call || parseCallChip(message?.content);
  if (!parsed) return null;

  const { event, kind, durationSec, actorName } = parsed;
  const isVideo = kind === "video";
  const mine =
    message?.senderId &&
    meId &&
    message.senderId.toString() === meId.toString();
  const inAnyCall = Boolean(session || outgoing || incoming);
  const time = message?.createdAt ? formatTime(message.createdAt) : "";

  const KindIcon = isVideo ? Video : Phone;
  let Icon = KindIcon;
  let tone = "accent";
  let title = isVideo ? "Video call" : "Voice call";
  let sub = "";
  let showCallback = false;

  if (event === "started") {
    sub = mine
      ? "You started the call"
      : `${actorName || "Someone"} started the call`;
  } else if (event === "cancelled") {
    Icon = PhoneOff;
    tone = "muted";
    title = isVideo ? "Video call cancelled" : "Voice call cancelled";
    sub = mine
      ? "You cancelled the call"
      : `${actorName || "Someone"} cancelled the call`;
    showCallback = true;
  } else if (event === "declined") {
    Icon = PhoneOff;
    tone = "danger";
    title = "Call declined";
    sub = mine
      ? "You declined the call"
      : `${actorName || "Someone"} declined the call`;
    showCallback = true;
  } else if (event === "missed") {
    Icon = PhoneMissed;
    tone = "danger";
    title = isVideo ? "Missed video call" : "Missed voice call";
    sub = mine ? "You called" : `${actorName || "Someone"} called`;
    showCallback = true;
  } else if (event === "ended") {
    tone = "success";
    title = isVideo ? "Video call" : "Voice call";
    sub = `Ended · ${formatChipDuration(durationSec)}`;
    showCallback = true;
  }

  const toneCls =
    tone === "danger"
      ? "bg-[var(--destructive)]/10 text-[var(--destructive)]"
      : tone === "success"
        ? "bg-[#22c55e]/10 text-[#22c55e]"
        : tone === "muted"
          ? "bg-[var(--hover)] text-[var(--text-muted)]"
          : "bg-[var(--accent)]/10 text-[var(--accent)]";

  const handleCallback = () => {
    if (inAnyCall) return;
    const conv = resolveConv?.(message?.conversationId);
    if (conv) startCall?.(conv, kind);
  };

  return (
    <div className="my-2 flex justify-center px-2">
      <div className="flex w-full max-w-[320px] items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-3.5 py-3 shadow-sm">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full",
            toneCls,
          )}
          aria-hidden="true"
        >
          <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-[var(--text-primary)]">
            {title}
          </span>
          <span className="block truncate text-[12px] text-[var(--text-muted)]">
            {sub}
            {time ? ` · ${time}` : ""}
          </span>
        </span>
        {showCallback && (
          <button
            type="button"
            onClick={handleCallback}
            disabled={inAnyCall}
            title={inAnyCall ? "Already in a call" : `Call back (${kind})`}
            aria-label={`Call back (${kind})`}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1.5 text-[12px] font-semibold text-[var(--on-accent)] transition-opacity duration-150 hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
          >
            <Phone className="h-3.5 w-3.5" strokeWidth={2} />
            {isVideo ? "Video" : "Call"}
          </button>
        )}
      </div>
    </div>
  );
}

// Compact avatar variant for group tiles — reserved for future use.
export function CallChipAvatar({ name, url }) {
  return <Avatar name={name} url={url} size="sm" />;
}

export default CallChip;
