"use client";

import { Check, CheckCheck, FaceGrinning, Pencil, Reply, Trash } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/motion/context-menu";
import { formatTime } from "@/lib/chat";
import { EASE_OUT_CSS } from "@/lib/ease";
import { cn } from "@/lib/utils";

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

import { MentionToken } from "@/components/mentions/mention-token";
import { AttachmentBubble } from "@/components/chat/attachments";

function MessageContent({ content, mentions = [], participants = [], isUserOnline, onOpenProfile }) {
  if (!content) return null;

  const resolvedUsernames = {};
  const mentionsSet = new Set((mentions || []).map((m) => m.toString()));

  for (const p of participants || []) {
    if (!p) continue;
    const pid = (p.id || p._id || p)?.toString?.();
    if (pid && mentionsSet.has(pid) && p.username) {
      resolvedUsernames[p.username.toLowerCase()] = p;
    }
  }

  if (Object.keys(resolvedUsernames).length === 0) {
    return <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{content}</span>;
  }

  const parts = [];
  let lastIndex = 0;
  const regex = /@([a-zA-Z0-9_.-]+)/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const rawMatch = match[0];
    const uname = match[1];
    const lower = uname.toLowerCase();

    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    if (resolvedUsernames[lower]) {
      const user = resolvedUsernames[lower];
      const uid = (user.id || user._id)?.toString?.();
      const online = Boolean(isUserOnline?.(uid));
      parts.push(
        <MentionToken
          key={`${match.index}-${lower}`}
          username={uname}
          user={user}
          isOnline={online}
          onOpenProfile={onOpenProfile}
        />
      );
    } else {
      parts.push(rawMatch);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{parts}</span>;
}

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
  onReply,
  isReplying = false,
  receipt,
  variant,
  className,
  contentClassName,
  replyTo,
  participants = [],
  isUserOnline,
  onOpenProfile,
  isMobile = false,
}) {
  const deleted = message.isDeleted;
  const editRef = useRef(null);
  const [pressing, setPressing] = useState(false);
  const [likeAnimKey, setLikeAnimKey] = useState(0);
  const reduceMotion = useReducedMotion();

  // --- Double-click / double-tap like — optimized ---
  const lastTapRef = useRef(0);
  const likeStartRef = useRef(null);
  const likeCooldownRef = useRef(0);
  const animTimerRef = useRef(null);
  const tapResetTimerRef = useRef(null);

  useEffect(() => {
    if (isEditing) editRef.current?.focus();
  }, [isEditing]);

  // cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      if (tapResetTimerRef.current) clearTimeout(tapResetTimerRef.current);
    };
  }, []);

  const triggerLike = useCallback(() => {
    if (deleted || isEditing) return;
    const now = Date.now();
    // throttle: ignore if liked < 500ms ago (spam / accidental triple tap)
    if (now - likeCooldownRef.current < 500) return;
    likeCooldownRef.current = now;

    if (navigator.vibrate) navigator.vibrate(20);

    // restart heart pop animation — auto-hide after 850ms for clean exit
    setLikeAnimKey((k) => k + 1);
    if (animTimerRef.current) clearTimeout(animTimerRef.current);
    animTimerRef.current = setTimeout(() => setLikeAnimKey(0), 850);

    onReact?.("❤️");
  }, [deleted, isEditing, onReact]);

  const handleDoubleClick = useCallback(
    (e) => {
      // Prevent the browser's word-selection on double-click
      if (window.getSelection) {
        const sel = window.getSelection();
        if (sel && sel.toString().length > 0) sel.removeAllRanges();
      }
      // Don't double-like when interacting with nested controls (e.g. mention token)
      if (e.target.closest?.("a, button")) return;
      e.preventDefault();
      triggerLike();
    },
    [triggerLike]
  );

  const handleLikeTouchStart = useCallback((e) => {
    const t = e.touches?.[0];
    if (t) likeStartRef.current = { x: t.clientX, y: t.clientY };
  }, []);

  const handleTouchEnd = useCallback(
    (e) => {
      if (deleted || isEditing) return;
      // ignore swipes / scrolls — only taps should trigger like
      const endT = e.changedTouches?.[0];
      if (likeStartRef.current && endT) {
        const dx = Math.abs(endT.clientX - likeStartRef.current.x);
        const dy = Math.abs(endT.clientY - likeStartRef.current.y);
        if (dx > 10 || dy > 10) {
          lastTapRef.current = 0;
          likeStartRef.current = null;
          return;
        }
      }
      likeStartRef.current = null;
      const now = Date.now();
      const delta = now - lastTapRef.current;
      if (delta > 0 && delta < 300) {
        // double-tap detected
        if (e.cancelable) e.preventDefault();
        lastTapRef.current = 0;
        if (tapResetTimerRef.current) clearTimeout(tapResetTimerRef.current);
        if (e.target.closest?.("a, button")) return;
        triggerLike();
      } else {
        lastTapRef.current = now;
        if (tapResetTimerRef.current) clearTimeout(tapResetTimerRef.current);
        tapResetTimerRef.current = setTimeout(() => {
          lastTapRef.current = 0;
        }, 350);
      }
    },
    [deleted, isEditing, triggerLike]
  );

  // Sent messages use the primary (accent) bubble, received use the secondary.
  const bubbleVariant = variant ?? (mine ? "default" : "secondary");

  return (
    <ContextMenu>
      <ContextMenuTrigger disabled={deleted || isEditing}>
        <Bubble
          variant={bubbleVariant}
          align={mine ? "end" : "start"}
          className={cn(
            "group/bubble relative transition-transform will-change-transform select-text touch-manipulation",
            pressing && "scale-[0.98]",
            isReplying && "border-l-2 border-[var(--accent)]",
            className
          )}
          style={{ transitionTimingFunction: EASE_OUT_CSS }}
          onPointerDown={() => setPressing(true)}
          onPointerUp={() => setPressing(false)}
          onPointerLeave={() => setPressing(false)}
          onPointerCancel={() => setPressing(false)}
          onDoubleClick={handleDoubleClick}
          onTouchStart={handleLikeTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <BubbleContent className={cn("min-w-0", contentClassName)}>
            {replyTo ? (
              <div className="mb-1.5 min-w-0 overflow-hidden rounded-md border-l-2 border-[var(--accent)] bg-black/5 px-2 py-1 dark:bg-white/10">
                <span className="block truncate text-[11px] font-semibold text-[var(--accent)]">
                  {replyTo.senderName}
                </span>
                <span className="block break-words text-[12px] leading-snug text-[var(--text-muted)] [overflow-wrap:anywhere]">
                  {replyTo.content}
                </span>
              </div>
            ) : null}
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
              <span className="opacity-20 bg-transparent bg-red-800">This message was deleted</span>
            ) : (
              <>
                <MessageContent
                  content={message.content}
                  mentions={message.mentions}
                  participants={participants}
                  isUserOnline={isUserOnline}
                  onOpenProfile={onOpenProfile}
                />
                <AttachmentBubble attachments={message.attachments} />
              </>
            )}
          </BubbleContent>

          <AnimatePresence>
            {likeAnimKey > 0 && (
              <motion.div
                key={likeAnimKey}
                initial={reduceMotion ? { opacity: 0 } : { scale: 0, opacity: 0 }}
                animate={
                  reduceMotion
                    ? { opacity: 1 }
                    : { scale: [0, 1.25, 1], opacity: [0, 1, 1] }
                }
                exit={
                  reduceMotion
                    ? { opacity: 0 }
                    : { scale: 1.4, opacity: 0, filter: "blur(2px)" }
                }
                transition={
                  reduceMotion
                    ? { duration: 0.15 }
                    : { duration: 0.55, ease: [0.16, 1, 0.3, 1] }
                }
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
                style={{ willChange: "transform, opacity" }}
                aria-hidden="true"
              >
                <span
                  className={cn(
                    "select-none text-5xl drop-shadow-[0_4px_12px_rgba(244,0,81,0.35)]",
                    !reduceMotion && "animate-[t-like-heart-pop_550ms_cubic-bezier(0.34,1.56,0.64,1)]"
                  )}
                >
                  ❤️
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Reaction picker */}
          {reactionOpen && (
            <div
              className={cn(
                "absolute bottom-full z-10 mb-1 flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1",
                mine ? "right-0" : "left-0"
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
      </ContextMenuTrigger>

      <ContextMenuContent ariaLabel="Message actions">
        <ContextMenuItem onSelect={() => onToggleReactionPicker?.()}>
          <FaceGrinning className="h-4 w-4" />
          React
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onReply?.(message)}>
          <Reply className="h-4 w-4" />
          Reply
        </ContextMenuItem>
        {mine && (
          <ContextMenuItem onSelect={() => onEdit?.()}>
            <Pencil className="h-4 w-4" />
            Edit
          </ContextMenuItem>
        )}
        {mine && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem tone="destructive" onSelect={() => onDelete?.()}>
              <Trash className="h-4 w-4" />
              Delete
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>

      {/* Reaction chips — in normal flow under the bubble, aligned to its side
          so they never overlap the corner. */}
      {message.reactions && message.reactions.length > 0 && (
        <div
          className={cn(
            "mt-1 flex max-w-[78%] flex-wrap gap-1",
            mine ? "justify-end" : "justify-start"
          )}
        >
          {Object.entries(
            message.reactions.reduce((acc, r) => {
              acc[r.emoji] = (acc[r.emoji] || 0) + 1;
              return acc;
            }, {})
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
            <button type="button" onClick={onRetry} className="text-[var(--accent)] hover:underline">
              failed · retry
            </button>
          )}
          {receipt === "sent" && <Check className="h-3 w-3" aria-label="Sent" />}
          {receipt === "delivered" && <CheckCheck className="h-3 w-3" aria-label="Delivered" />}
          {receipt === "read" && <CheckCheck className="h-3 w-3 text-[var(--accent)]" aria-label="Read" />}
        </div>
      )}
    </ContextMenu>
  );
}

export default MessageBubble;
