"use client";

import { CornerDownLeft, Loader2, MessageSquareText, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/dashboard/avatar";
import { MessageBubble } from "@/components/dashboard/message-bubble";
import { useSocket } from "@/components/socket-provider";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { formatTime } from "@/lib/chat";
import { copyText, messageText } from "@/lib/clipboard";

// Thread side panel: replies to a root message live here, excluded from the
// main timeline. Any member of the conversation can join; replying posts a
// plain message with `threadId` set server-side (no quote/forward/caption).
export function ThreadPanel({
  conversation,
  root,
  onClose,
  onActivity,
  onForward,
  onOpenProfile,
  isMobile = false,
}) {
  const { socket } = useSocket();
  const currentUser = getSession();
  const userId = currentUser?.id;
  const convId = conversation?.id || null;

  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const listRef = useRef(null);
  const copiedTimerRef = useRef(null);

  // Index members so sender names/avatars render without extra fetches.
  const membersById = useMemo(() => {
    const map = {};
    for (const p of conversation?.participants || []) {
      const id = p?.id || p?._id || p;
      if (id) map[id.toString()] = p;
    }
    return map;
  }, [conversation]);

  const senderName = (senderId) => {
    const s = membersById[senderId];
    return s ? s.displayName || s.username || "Someone" : "Unknown";
  };
  const senderAvatar = (senderId) => {
    const s = membersById[senderId];
    return s
      ? { avatarStyle: s.avatarStyle, avatarUrl: s.avatarUrl }
      : { avatarStyle: null, avatarUrl: null };
  };

  const rootAuthor = senderName(root?.senderId);

  // Load the thread on open (oldest first, chat-like).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiGet(`/api/v1/conversations/${convId}/threads/${root.id}/messages`)
      .then((data) => {
        if (cancelled) return;
        setReplies(Array.isArray(data?.messages) ? data.messages : []);
      })
      .catch(() => {
        if (!cancelled) setReplies([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId, root?.id]);

  useEffect(() => {
    if (loading || replies.length === 0) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [replies.length, loading]);

  // Live updates: replies arrive through the same conversation room as every
  // other message, so we subscribe to the same events and filter by thread.
  useEffect(() => {
    if (!socket || !convId) return undefined;
    const threadMatch = (msg) =>
      msg?.conversationId === convId && msg?.threadId === root.id;

    const onNew = (msg) => {
      if (!threadMatch(msg)) return;
      setReplies((prev) =>
        prev.some((r) => r.id === msg.id) ? prev : [...prev, msg],
      );
      onActivity?.();
    };
    const onEdited = (msg) => {
      if (!threadMatch(msg)) return;
      setReplies((prev) =>
        prev.map((r) =>
          r.id === msg.id
            ? { ...r, content: msg.content, isEdited: msg.isEdited }
            : r,
        ),
      );
    };
    const onDeleted = (msg) => {
      if (!threadMatch(msg)) return;
      setReplies((prev) =>
        prev.map((r) =>
          r.id === msg.id ? { ...r, isDeleted: true, content: "" } : r,
        ),
      );
      onActivity?.();
    };
    const onReaction = (payload) => {
      setReplies((prev) =>
        prev.map((r) =>
          r.id === payload?.messageId
            ? { ...r, reactions: payload.reactions }
            : r,
        ),
      );
    };

    socket.on("message:new", onNew);
    socket.on("message:edited", onEdited);
    socket.on("message:deleted", onDeleted);
    socket.on("message:reaction", onReaction);
    return () => {
      socket.off("message:new", onNew);
      socket.off("message:edited", onEdited);
      socket.off("message:deleted", onDeleted);
      socket.off("message:reaction", onReaction);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, convId, root?.id, onActivity]);

  const send = async () => {
    const content = text.trim();
    if (!content || sending || !convId) return;
    setSending(true);
    try {
      const msg = await apiPost(`/api/v1/conversations/${convId}/messages`, {
        content,
        threadId: root.id,
      });
      setReplies((prev) =>
        prev.some((r) => r.id === msg.id) ? prev : [...prev, msg],
      );
      setText("");
      onActivity?.();
    } catch {
      // Keep the text so the user doesn't lose it on a transient failure.
    } finally {
      setSending(false);
    }
  };

  const toggleReaction = async (id, emoji) => {
    try {
      const reactions = await apiPost(`/api/v1/messages/${id}/reactions`, {
        emoji,
      });
      setReplies((prev) =>
        prev.map((r) => (r.id === id ? { ...r, reactions } : r)),
      );
    } catch {
      /* socket echo reconciles when it succeeds server-side */
    }
  };

  const removeMessage = async (id) => {
    setReplies((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, isDeleted: true, content: "" } : r,
      ),
    );
    onActivity?.();
    try {
      await apiDelete(`/api/v1/messages/${id}`);
    } catch {
      /* socket echo reconciles */
    }
  };

  const toggleSaveReply = async (reply) => {
    const next = !reply.saved;
    setReplies((prev) =>
      prev.map((r) => (r.id === reply.id ? { ...r, saved: next } : r)),
    );
    try {
      const updated = await apiPost(`/api/v1/messages/${reply.id}/save`, {
        saved: next,
      });
      setReplies((prev) =>
        prev.map((r) => (r.id === reply.id ? { ...r, ...updated } : r)),
      );
    } catch {
      setReplies((prev) =>
        prev.map((r) =>
          r.id === reply.id ? { ...r, saved: !next } : r,
        ),
      );
    }
  };

  const copyMessage = async (m) => {
    const textToCopy = messageText(m);
    if (!textToCopy) return;
    const ok = await copyText(textToCopy);
    if (!ok) return;
    setCopiedId(m.id);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopiedId(null), 1600);
  };

  const openProfileForSender = (m) => {
    const sender = membersById[m.senderId];
    if (sender?.username) onOpenProfile?.(sender.username);
  };

  return (
    <section
      aria-label="Thread"
      className="absolute inset-0 z-40 flex flex-col bg-[var(--bg-surface)] sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[380px] sm:border-l sm:border-[var(--border)]"
    >
      {/* Panel header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-base)] px-4">
        <div className="flex min-w-0 items-center gap-2">
          <MessageSquareText className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
          <h2 className="truncate font-sans text-[14px] font-semibold text-[var(--text-primary)]">
            Thread
          </h2>
          {!loading && replies.length > 0 && (
            <span className="text-[12px] text-[var(--text-muted)]">
              · {replies.length} {replies.length === 1 ? "reply" : "replies"}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close thread"
          className="kivo-focus flex size-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* Root message context */}
      <div className="border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-start gap-2.5">
          <Avatar
            name={rootAuthor}
            avatarStyle={senderAvatar(root?.senderId).avatarStyle}
            url={senderAvatar(root?.senderId).avatarUrl}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="truncate text-[13px] font-semibold text-[var(--text-primary)]">
                {rootAuthor}
              </span>
              {root?.createdAt && (
                <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
                  {formatTime(root.createdAt)}
                </span>
              )}
            </div>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] text-[var(--text-secondary)] [overflow-wrap:anywhere] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:4] overflow-hidden">
              {root?.content || "This message has no text"}
            </p>
            {root?.attachments?.length > 0 && (
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                📎 {root.attachments.length}{" "}
                {root.attachments.length === 1 ? "attachment" : "attachments"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      <div
        ref={listRef}
        className="t-scroll flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4"
      >
        {loading ? (
          <div className="flex h-full items-center justify-center text-[var(--text-muted)]">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          </div>
        ) : replies.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
            <MessageSquareText className="h-7 w-7 text-[var(--text-muted)]" aria-hidden />
            <p className="text-[13px] font-medium text-[var(--text-primary)]">
              No replies yet
            </p>
            <p className="max-w-[240px] text-[12px] text-[var(--text-muted)]">
              Reply below to start the discussion. Everyone in the chat can see
              and join this thread.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {replies.map((reply) => {
              const mine = reply.senderId === userId;
              const av = senderAvatar(reply.senderId);
              return (
                <div
                  key={reply.id}
                  className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : "flex-row"}`}
                >
                  {!mine && (
                    <Avatar
                      name={senderName(reply.senderId)}
                      avatarStyle={av.avatarStyle}
                      url={av.avatarUrl}
                      size="sm"
                    />
                  )}
                  <div
                    className={`flex min-w-0 flex-col ${mine ? "items-end" : "items-start"} max-w-[85%]`}
                  >
                    {!mine && (
                      <span className="mb-0.5 ml-1 text-[11px] font-medium text-[var(--text-muted)]">
                        {senderName(reply.senderId)}
                      </span>
                    )}
                    <MessageBubble
                      message={reply}
                      mine={mine}
                      participants={conversation?.participants || []}
                      onOpenProfile={openProfileForSender}
                      onReact={(emoji) => toggleReaction(reply.id, emoji)}
                      onDelete={
                        mine ? () => removeMessage(reply.id) : undefined
                      }
                      onCopy={() => copyMessage(reply)}
                      onSaveToggle={
                        !reply.isDeleted ? () => toggleSaveReply(reply) : undefined
                      }
                      onForward={onForward ? () => onForward(reply) : undefined}
                      onProfile={
                        !mine && membersById[reply.senderId]?.username
                          ? () => openProfileForSender(reply)
                          : undefined
                      }
                      isMobile={isMobile}
                      className="!max-w-full"
                      contentClassName="max-w-full"
                    />
                    {copiedId === reply.id && (
                      <span className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                        Copied
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-base)] px-3 py-2.5">
        <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 focus-within:border-[var(--accent)]">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                send();
              }
            }}
            placeholder={`Reply in thread…`}
            aria-label="Reply in thread"
            maxLength={4000}
            className="min-w-0 flex-1 bg-transparent text-[13.5px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          />
          <button
            type="button"
            onClick={send}
            disabled={!text.trim() || sending}
            aria-label="Send reply"
            className="kivo-focus flex size-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CornerDownLeft className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </section>
  );
}
