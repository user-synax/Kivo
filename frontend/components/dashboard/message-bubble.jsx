"use client";

import { Check, CheckCheck, FaceGrinning, Pencil, Trash } from "lucide-react";
import { useEffect, useRef } from "react";
import { formatTime } from "@/lib/chat";

// A single chat message bubble. Visuals are driven entirely by CSS variables
// (see `.t-bubble` in globals.css) so a new bubble theme is just a
// `[data-bubble-theme="…"]` override of `--bubble-sent` / `--bubble-received` —
// no component changes required. Layout is responsive (relative max-width,
// break-anywhere) and the component is presentational: all state lives in the
// parent (chat-panel) and is passed in as props.

export const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export function MessageBubble({
  message,
  mine,
  showTail = true,
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
  bubbleTheme,
}) {
  const deleted = message.isDeleted;
  const editRef = useRef(null);

  useEffect(() => {
    if (isEditing) editRef.current?.focus();
  }, [isEditing]);

  const tailClass = showTail ? "with-tail" : "";

  return (
    <>
      <div
        data-bubble-theme={bubbleTheme}
        className={`t-bubble ${mine ? "is-mine" : "is-other"} ${
          deleted ? "is-deleted" : ""
        } ${tailClass}`}
      >
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
            className="w-full resize-none bg-transparent text-sm text-[var(--text-primary)] focus:outline-none"
            rows={2}
            ref={editRef}
          />
        ) : deleted ? (
          <span>This message was deleted</span>
        ) : (
          <span className="whitespace-pre-wrap">{message.content}</span>
        )}

        {/* Hover actions (react / edit / delete) */}
        {!deleted && !isEditing && (
          <div
            className={`absolute -top-3 ${
              mine ? "left-0 -translate-x-full" : "right-0 translate-x-full"
            } hidden items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-1 py-0.5 group-hover:flex`}
          >
            <button
              type="button"
              onClick={onToggleReactionPicker}
              aria-label="React"
              className="flex size-6 hover:cursor-pointer items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
            >
              <FaceGrinning className="h-3 w-3" />
            </button>
            {mine && (
              <button
                type="button"
                onClick={onEdit}
                aria-label="Edit"
                className="flex size-6 hover:cursor-pointer items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
            {mine && (
              <button
                type="button"
                onClick={onDelete}
                aria-label="Delete"
                className="flex hover:cursor-pointer size-6 items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
              >
                <Trash className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {/* Reaction picker */}
        {reactionOpen && (
          <div
            className={`absolute bottom-full z-10 mb-1 flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1 ${
              mine ? "right-0" : "left-0"
            }`}
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
      </div>

      {/* Reaction chips — sit in normal flow directly under the bubble, aligned
          to its side and wrapping on narrow screens (no longer overlapping the
          corner). The parent column's items-start / items-end keeps them pinned
          to the same edge as the bubble. */}
      {message.reactions && message.reactions.length > 0 && (
        <div
          className={`mt-1 flex max-w-[78%] flex-wrap gap-1 ${
            mine ? "justify-end" : "justify-start"
          }`}
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
          {/* Read receipt: single check until delivered, double check (colored)
              once the recipient has actually seen the message. */}
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
