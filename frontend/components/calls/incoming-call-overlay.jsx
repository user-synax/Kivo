"use client";

import { Mic, Phone, PhoneOff, Video } from "lucide-react";
import { Avatar } from "@/components/dashboard/avatar";
import { useCalls } from "./call-provider";

// Incoming call: full-screen takeover on mobile, centered card on desktop.
// The ringtone is owned by the provider; this is pure UI + accept/decline.
export function IncomingCallOverlay() {
  const { incoming, resolveConv, acceptCall, declineCall } = useCalls() || {};

  if (!incoming) return null;

  const conversation = resolveConv?.(incoming.conversationId);
  const isGroup = conversation?.type === "group";
  const callerName =
    incoming.caller?.displayName || incoming.caller?.username || "Someone";
  const isVideo = incoming.kind === "video";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Incoming ${isVideo ? "video" : "voice"} call from ${callerName}`}
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
    >
      <div className="relative flex w-full max-w-sm flex-col items-center gap-4 overflow-hidden rounded-t-3xl border border-[var(--border)] bg-[var(--bg-surface)] px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-8 text-center shadow-2xl sm:rounded-3xl sm:py-8">
        {/* Pulsing avatar */}
        <span className="relative grid place-items-center" aria-hidden="true">
          <span className="absolute inset-0 animate-ping rounded-full bg-[var(--accent)]/20 [animation-duration:1.8s]" />
          <Avatar
            name={callerName}
            avatarStyle={incoming.caller?.avatarStyle}
            url={incoming.caller?.avatarUrl}
          />
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-[var(--text-primary)]">
            {callerName}
          </p>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-[13px] text-[var(--text-muted)]">
            {isVideo ? (
              <Video className="h-4 w-4" strokeWidth={1.8} />
            ) : (
              <Mic className="h-4 w-4" strokeWidth={1.8} />
            )}
            Incoming {isVideo ? "video" : "voice"} call
            {isGroup && conversation?.name ? ` · ${conversation.name}` : ""}
          </p>
        </div>
        <div className="mt-2 flex w-full items-center justify-center gap-6">
          <span className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => declineCall?.()}
              aria-label="Decline call"
              className="flex size-14 items-center justify-center rounded-full bg-[var(--destructive)] text-white shadow-lg transition-transform duration-150 hover:scale-105 active:scale-95"
            >
              <PhoneOff className="h-6 w-6" />
            </button>
            <span className="text-[11px] text-[var(--text-muted)]">
              Decline
            </span>
          </span>
          <span className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => acceptCall?.()}
              aria-label="Accept call"
              className="flex size-14 items-center justify-center rounded-full bg-[#22c55e] text-white shadow-lg transition-transform duration-150 hover:scale-105 active:scale-95"
            >
              <Phone className="h-6 w-6" />
            </button>
            <span className="text-[11px] text-[var(--text-muted)]">Accept</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default IncomingCallOverlay;
