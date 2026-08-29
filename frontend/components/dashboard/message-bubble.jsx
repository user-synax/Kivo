"use client";

import { Check, CheckCheck, FaceGrinning, Pencil, Trash } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { formatTime } from "@/lib/chat";
import { cn } from "@/lib/utils";

// True on touch / no-hover devices (phones, tablets). Used to swap the
// desktop hover-reveal of message actions for a press-and-hold gesture.
function useIsTouch() {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: none) and (pointer: coarse)");
    setIsTouch(mq.matches);
    const onChange = (e) => setIsTouch(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return isTouch;
}

// A single chat message bubble built on shadcn's `Bubble` primitive.
//
// Customization:
//  - `mine`        controls side + default color (sent = primary, received = secondary)
//  - `variant`     override the shadcn Bubble variant (default | secondary | muted |
//                  tinted | outline | ghost | destructive) for full theming control
//  - `contentClassName` / `className` extra classes for the content / bubble
//
// Behavior (edit, delete, reactions, receipts, retry) is unchanged from before —
// all state lives in the parent (chat-panel) and is passed in as props.

export const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export function MessageBubble({
  message,
  mine,
  showMeta = true,
  reactionOpen = false,
  isEditing = false,
  editText = "",
  onEditTextChange,
  onSaveEdit,
  onCancelEdit,
  onToggleReactionPicker,
  onReact,
  onEdit,
  onDelete,
  onRetry,
  receipt,
  variant,
  className,
  contentClassName,
}) {
  const deleted = message.isDeleted;
  const editRef = useRef(null);
  const isTouch = useIsTouch();

  // Mobile: hold a bubble to reveal its actions. The timer is cancelled if the
  // finger moves (scroll) or lifts before the threshold, so it never fights scrolling.
  const [menuOpen, setMenuOpen] = useState(false);
  const pressTimer = useRef(null);

  const startPress = () => {
    if (!isTouch || deleted || isEditing) return;
    pressTimer.current = setTimeout(() => {
      setMenuOpen(true);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(12);
      }
    }, 450);
  };
  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  useEffect(() => {
    if (isEditing) editRef.current?.focus();
  }, [isEditing]);

  // Sent messages use the primary (accent) bubble, received use the secondary.
  const bubbleVariant = variant ?? (mine ? "default" : "secondary");

  return (
    <>
      {/* Tap-away layer while the mobile long-press menu is open. */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <Bubble
        variant={bubbleVariant}
        align={mine ? "end" : "start"}
        className={cn("group/bubble relative", isTouch && "select-none", className)}
        onTouchStart={startPress}
        onTouchEnd={cancelPress}
        onTouchMove={cancelPress}
        onContextMenu={(e) => {
          if (!isTouch) return;
          e.preventDefault();
          setMenuOpen((v) => !v);
        }}
      >
        <BubbleContent className={cn(contentClassName)}>
          {isEditing ? (
            <textarea
              value={editText}
              onChange={(e) => onEditTextChange?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSaveEdit?.();
                }
                if (e.key === "Escape") onCancelEdit?.();
              }}
              className="w-full resize-none bg-transparent text-sm text-current focus:outline-none"
              rows={2}
              ref={editRef}
            />
          ) : deleted ? (
            <span className="opacity-70">This message was deleted</span>
          ) : (
            <span className="whitespace-pre-wrap">{message.content}</span>
          )}
        </BubbleContent>

        {/* Hover actions (react / edit / delete). On touch devices these are
            also revealed by a long-press on the bubble. */}
        {!deleted && !isEditing && (
          <div
            className={cn(
              "absolute z-20 items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-1 py-0.5 shadow-md",
              menuOpen ? "flex" : "hidden group-hover/bubble:flex",
              mine
                ? "left-0 -top-3 -translate-x-full"
                : "right-0 -top-3 translate-x-full",
              "max-sm:left-1/2 max-sm:-top-2 max-sm:-translate-x-1/2 max-sm:translate-y-0",
            )}
          >
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onToggleReactionPicker?.();
              }}
              aria-label="React"
              className="flex size-6 items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
            >
              <FaceGrinning className="h-3 w-3" />
            </button>
            {mine && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit?.();
                }}
                aria-label="Edit"
                className="flex size-6 items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
            {mine && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete?.();
                }}
                aria-label="Delete"
                className="flex size-6 items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
              >
                <Trash className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {/* Reaction picker */}
        {reactionOpen && (
          <div
            className={cn(
              "absolute bottom-full z-10 mb-1 flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1",
              mine ? "right-0" : "left-0",
            )}
          >
            {REACTION_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => onReact?.(e)}
                className="rounded px-1 text-base transition-colors hover:bg-[var(--hover)]"
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </Bubble>

      {/* Reaction chips — in normal flow under the bubble, aligned to its side
          so they never overlap the corner. */}
      {message.reactions && message.reactions.length > 0 && (
        <div
          className={cn(
            "mt-1 flex max-w-[78%] flex-wrap gap-1",
            mine ? "justify-end" : "justify-start",
          )}
        >
          {Object.entries(
            message.reactions.reduce((acc, r) => {
              acc[r.emoji] = (acc[r.emoji] || 0) + 1;
              return acc;
            }, {}),
          ).map(([emoji, count]) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onReact?.(emoji)}
              className="flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[11px] leading-none text-[var(--text-primary)] transition-colors hover:bg-[var(--hover)]"
            >
              {emoji} {count}
            </button>
          ))}
        </div>
      )}

      {/* Meta: time + receipt + failed retry (rendered once per group) */}
      {showMeta && (
        <div className="mt-1 flex items-center gap-1.5 px-1 text-[11px] text-[var(--text-muted)]">
          <span>{formatTime(message.createdAt)}</span>
          {message.isEdited && <span>· edited</span>}
          {message.status === "failed" && (
            <button
              type="button"
              onClick={onRetry}
              className="text-[var(--accent)] hover:underline"
            >
              failed · retry
            </button>
          )}
          {receipt === "sent" && (
            <Check className="h-3 w-3" aria-label="Sent" />
          )}
          {receipt === "delivered" && (
            <CheckCheck className="h-3 w-3" aria-label="Delivered" />
          )}
          {receipt === "read" && (
            <CheckCheck
              className="h-3 w-3 text-[var(--accent)]"
              aria-label="Read"
            />
          )}
        </div>
      )}
    </>
  );
}

export default MessageBubble;
