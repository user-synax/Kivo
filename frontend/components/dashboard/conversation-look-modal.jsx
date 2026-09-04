"use client";

import { Check, Loader2, Palette, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  BubbleStylePicker,
  WallpaperPicker,
} from "@/components/dashboard/chat-style-picker";
import { apiPatch } from "@/lib/api";

// Shared chat-look editor for a DM or group (wallpaper + bubble style).
//
// The look lives on the Conversation and is seen by everyone in the chat, so
// it layers on top of each member's own look while they view this chat:
//   per-conversation field  >  per-Space look (its channels)  >  member's own
// A null field = inherit ("Member's own"). Editing rules mirror Space looks:
// either DM participant, or group admins only — everyone else gets a
// read-only summary.
export function ConversationLookModal({ conversation, onClose, onSaved }) {
  const isDm = conversation?.type === "dm";
  const canEdit = isDm || Boolean(conversation?.isAdmin);
  const saved = conversation?.appearance || {};

  const [wallpaper, setWallpaper] = useState(saved.wallpaper || null);
  const [bubbleStyle, setBubbleStyle] = useState(saved.bubbleStyle || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Keep draft in sync when the conversation or its look changes underneath
  // (e.g. the other admin saved while this modal was open).
  // biome-ignore lint/correctness/useExhaustiveDependencies: draft syncs only when the conversation or its look changes underneath
  useEffect(() => {
    setWallpaper(saved.wallpaper || null);
    setBubbleStyle(saved.bubbleStyle || null);
    setError(null);
  }, [
    conversation?.id,
    conversation?.appearance?.wallpaper,
    conversation?.appearance?.bubbleStyle,
  ]);

  const hasChanges =
    (wallpaper || null) !== (saved.wallpaper || null) ||
    (bubbleStyle || null) !== (saved.bubbleStyle || null);
  const hasLook = Boolean(saved.wallpaper || saved.bubbleStyle);

  const save = async (values) => {
    if (!canEdit) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await apiPatch(
        `/api/v1/conversations/${conversation.id}/look`,
        values,
      );
      onSaved?.(updated);
    } catch (e) {
      setError(e?.message || "Could not save the chat look");
    } finally {
      setBusy(false);
    }
  };

  const saveLook = () =>
    save({
      wallpaper: wallpaper || null,
      bubbleStyle: bubbleStyle || null,
    });
  const resetLook = () => {
    setWallpaper(null);
    setBubbleStyle(null);
    save({ wallpaper: null, bubbleStyle: null });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close chat look editor"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Chat look"
        className="relative z-10 flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface)] text-[var(--text-muted)]">
              <Palette className="h-4 w-4" strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold tracking-tight text-[var(--text-primary)]">
                Chat look
              </h2>
              <p className="truncate text-[12px] text-[var(--text-muted)]">
                {conversation.name || "Direct message"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {canEdit ? (
            <>
              <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">
                Give this chat its own wallpaper and bubble style. Everyone in
                the conversation sees it layered on their theme. Pick{" "}
                <span className="font-medium text-[var(--text-primary)]">
                  Member&apos;s own
                </span>{" "}
                to follow each person&apos;s preference instead.
              </p>

              <p className="mb-1.5 mt-4 text-[12px] font-medium text-[var(--text-primary)]">
                Wallpaper
              </p>
              <WallpaperPicker
                value={wallpaper}
                onChange={setWallpaper}
                allowInherit
              />

              <p className="mb-1.5 mt-4 text-[12px] font-medium text-[var(--text-primary)]">
                Bubble style
              </p>
              <BubbleStylePicker
                value={bubbleStyle}
                onChange={setBubbleStyle}
                allowInherit
              />

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {hasChanges ? (
                  <button
                    type="button"
                    onClick={saveLook}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-[12px] font-semibold text-[var(--on-accent)] transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Save look
                  </button>
                ) : hasLook ? (
                  <button
                    type="button"
                    onClick={resetLook}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-full border border-[var(--border)] px-4 py-2 text-[12px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)] disabled:opacity-40"
                  >
                    Reset to member&apos;s own
                  </button>
                ) : null}
                {error && (
                  <span className="text-[11px] text-[var(--destructive)]">
                    {error}
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">
              {hasLook
                ? "This chat has a custom look — you'll see it whenever you open it."
                : "This chat uses everyone's own look. Only group admins can change it."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ConversationLookModal;
