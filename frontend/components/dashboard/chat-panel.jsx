"use client";

import { Smile } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EmojiPicker } from "@/components/dashboard/emoji-picker";
import { MessageBubble } from "@/components/dashboard/message-bubble";
import { useSocket } from "@/components/socket-provider";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { getSession } from "@/lib/auth";
import {
  otherParticipant,
  participantAvatarName,
  participantName,
} from "@/lib/chat";

const TYPING_IDLE_MS = 1500;
// Messages from the same sender within this window are visually grouped.
const GROUP_WINDOW_MS = 60000;

function initials(name) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Online / Offline status label — uses the transitions-dev text-states-swap:
// the keyed span remounts on change so it blur-rises in (reduced-motion safe).
function StatusText({ online }) {
  return (
    <span key={online ? "on" : "off"} className="t-text-swap">
      {online ? "Online" : "Offline"}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-[var(--bg-base)] px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)]">
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 5h16v11H9l-4 4V5z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <p className="text-sm text-[var(--text-muted)]">
        Select a conversation to start chatting
      </p>
    </div>
  );
}

// Read-receipt state for the current user's own messages.
function receiptState(message, userId, otherId) {
  if (message.senderId !== userId) return null;
  const read = otherId && message.readBy?.some((r) => r.userId === otherId);
  const delivered =
    otherId && message.deliveredTo?.some((id) => id === otherId);
  if (read) return "read";
  if (delivered) return "delivered";
  return "sent";
}

export function ChatPanel({ conversation, onBack }) {
  const socket = useSocket();
  const currentUser = getSession();
  const userId = currentUser?.id;

  const convId = conversation?.id || null;
  const other = conversation ? otherParticipant(conversation, userId) : null;
  const otherId = other?.id || null;
  const otherName = participantName(other);
  const online = Array.isArray(conversation?.online)
    ? conversation.online.some(Boolean)
    : Boolean(conversation?.online);

  const [messages, setMessages] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [otherOnline, setOtherOnline] = useState(online);
  const [reactionFor, setReactionFor] = useState(null); // messageId with open picker
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const textareaRef = useRef(null);
  const emojiBtnRef = useRef(null);

  const scrollRef = useRef(null);
  const typingTimer = useRef(null);
  const bottomRef = useRef(null);

  // Sync presence dot when switching conversations.
  useEffect(() => {
    setOtherOnline(online);
  }, [online]);

  // Load message history when the conversation changes.
  useEffect(() => {
    if (!convId) {
      setMessages([]);
      setNextCursor(null);
      setHasMore(false);
      return undefined;
    }
    let active = true;
    setLoadingHistory(true);
    apiGet(`/api/v1/conversations/${convId}/messages?limit=50`)
      .then((data) => {
        if (!active) return;
        setMessages(data?.messages || []);
        setNextCursor(data?.nextCursor || null);
        setHasMore(Boolean(data?.nextCursor));
      })
      .catch(() => {
        if (active) setMessages([]);
      })
      .finally(() => {
        if (active) setLoadingHistory(false);
      });
    return () => {
      active = false;
    };
  }, [convId]);

  // Keep pinned to the bottom on new messages / typing changes.
  useEffect(() => {
    void messages.length;
    void typing;
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, typing]);

  // Load older messages (prepend) when the user scrolls to the top.
  const loadOlder = () => {
    if (!hasMore || !nextCursor || loadingHistory) return;
    setLoadingHistory(true);
    apiGet(
      `/api/v1/conversations/${convId}/messages?limit=50&cursor=${nextCursor}`,
    )
      .then((data) => {
        const older = data?.messages || [];
        setMessages((prev) => [...older, ...prev]);
        setNextCursor(data?.nextCursor || null);
        setHasMore(Boolean(data?.nextCursor));
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  };

  // Realtime event wiring for this conversation.
  useEffect(() => {
    if (!socket || !convId) return undefined;

    const reconcile = (msg) => {
      setMessages((prev) => {
        const byId = prev.findIndex((m) => m.id === msg.id);
        if (byId >= 0) {
          const copy = [...prev];
          copy[byId] = { ...copy[byId], ...msg, status: "sent" };
          return copy;
        }
        // Own message echoed back: replace a matching optimistic temp by content.
        if (msg.senderId === userId) {
          const t = prev.findIndex(
            (m) =>
              m.tempId &&
              m.senderId === userId &&
              m.content === msg.content &&
              (m.status === "sending" || m.status === "failed"),
          );
          if (t >= 0) {
            const copy = [...prev];
            copy[t] = { ...msg, status: "sent" };
            return copy;
          }
        }
        return [...prev, { ...msg, status: "sent" }];
      });
    };

    const onNew = (msg) => {
      if (msg.conversationId !== convId) return;
      reconcile(msg);
      socket.emit("message:delivered", { messageId: msg.id });
      if (msg.senderId !== userId) {
        apiPost(`/api/v1/conversations/${convId}/read`, {
          upToMessageId: msg.id,
        }).catch(() => {});
      }
    };
    const onReaction = (payload) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.messageId
            ? { ...m, reactions: payload.reactions }
            : m,
        ),
      );
    };
    const onRead = (payload) => {
      if (payload.conversationId !== convId || payload.userId === userId)
        return;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.senderId !== userId) return m;
          if (m.readBy?.some((r) => r.userId === payload.userId)) return m;
          return {
            ...m,
            readBy: [
              ...(m.readBy || []),
              { userId: payload.userId, readAt: new Date() },
            ],
          };
        }),
      );
    };
    const onDelivery = (payload) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.messageId
            ? { ...m, deliveredTo: payload.deliveredTo }
            : m,
        ),
      );
    };
    const onTypingStart = (p) => {
      if (p.conversationId === convId && p.userId !== userId) setTyping(true);
    };
    const onTypingStop = (p) => {
      if (p.conversationId === convId && p.userId !== userId) setTyping(false);
    };
    const onOnline = (p) => {
      if (p?.userId === otherId) setOtherOnline(true);
    };
    const onOffline = (p) => {
      if (p?.userId === otherId) setOtherOnline(false);
    };

    socket.on("message:new", onNew);
    socket.on("message:edited", reconcile);
    socket.on("message:deleted", reconcile);
    socket.on("message:reaction", onReaction);
    socket.on("message:read", onRead);
    socket.on("message:delivery-updated", onDelivery);
    socket.on("typing:start", onTypingStart);
    socket.on("typing:stop", onTypingStop);
    socket.on("presence:online", onOnline);
    socket.on("presence:offline", onOffline);

    return () => {
      socket.off("message:new", onNew);
      socket.off("message:edited", reconcile);
      socket.off("message:deleted", reconcile);
      socket.off("message:reaction", onReaction);
      socket.off("message:read", onRead);
      socket.off("message:delivery-updated", onDelivery);
      socket.off("typing:start", onTypingStart);
      socket.off("typing:stop", onTypingStop);
      socket.off("presence:online", onOnline);
      socket.off("presence:offline", onOffline);
    };
  }, [socket, convId, userId, otherId]);

  // Stop emitting "typing" when leaving the conversation.
  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (socket && convId)
        socket.emit("typing:stop", { conversationId: convId });
    };
  }, [socket, convId]);

  const emitTyping = () => {
    if (!socket || !convId) return;
    socket.emit("typing:start", { conversationId: convId });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket.emit("typing:stop", { conversationId: convId });
    }, TYPING_IDLE_MS);
  };

  // Insert an emoji at the caret position in the composer (falls back to
  // appending at the end when the textarea isn't focused).
  const insertEmoji = (emoji) => {
    const el = textareaRef.current;
    const start = el ? el.selectionStart : text.length;
    const end = el ? el.selectionEnd : text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      if (!el) return;
      const pos = start + emoji.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const send = async () => {
    const content = text.trim();
    if (!content || !convId) return;
    const tempId = `t_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const optimistic = {
      id: tempId,
      tempId,
      conversationId: convId,
      senderId: userId,
      content,
      reactions: [],
      deliveredTo: [],
      readBy: [],
      isEdited: false,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      status: "sending",
    };
    setMessages((prev) => [...prev, optimistic]);
    setText("");
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (socket) socket.emit("typing:stop", { conversationId: convId });
    try {
      const msg = await apiPost(`/api/v1/conversations/${convId}/messages`, {
        content,
      });
      setMessages((prev) =>
        prev.map((m) => (m.tempId === tempId ? { ...msg, status: "sent" } : m)),
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.tempId === tempId ? { ...m, status: "failed" } : m)),
      );
    }
  };

  const retry = (tempId) => {
    const m = messages.find((x) => x.tempId === tempId);
    if (!m) return;
    setMessages((prev) =>
      prev.map((x) => (x.tempId === tempId ? { ...x, status: "sending" } : x)),
    );
    apiPost(`/api/v1/conversations/${convId}/messages`, { content: m.content })
      .then((msg) =>
        setMessages((prev) =>
          prev.map((x) =>
            x.tempId === tempId ? { ...msg, status: "sent" } : x,
          ),
        ),
      )
      .catch(() =>
        setMessages((prev) =>
          prev.map((x) =>
            x.tempId === tempId ? { ...x, status: "failed" } : x,
          ),
        ),
      );
  };

  const toggleReaction = async (id, emoji) => {
    setReactionFor(null);
    try {
      const data = await apiPost(`/api/v1/messages/${id}/reactions`, { emoji });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, reactions: data.reactions } : m,
        ),
      );
    } catch {
      /* socket echo will still update if it succeeds server-side */
    }
  };

  const removeMessage = async (id) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, isDeleted: true, content: "" } : m,
      ),
    );
    try {
      await apiDelete(`/api/v1/messages/${id}`);
    } catch {
      /* socket echo reconciles on success */
    }
  };

  const saveEdit = async (id) => {
    const content = editText.trim();
    if (!content) return;
    const prevContent = messages.find((m) => m.id === id)?.content;
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content, isEdited: true } : m)),
    );
    setEditingId(null);
    try {
      const msg = await apiPatch(`/api/v1/messages/${id}`, { content });
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...msg } : m)),
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, content: prevContent, isEdited: false } : m,
        ),
      );
    }
  };

  if (!conversation) return <EmptyState />;

  return (
    <div className="flex h-full flex-col bg-[var(--bg-base)]">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border)] px-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to conversations"
            className="flex size-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M15 5l-7 7 7 7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
        <div className="relative lg:ml-14 flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-sm font-medium text-[var(--text-primary)]">
          {initials(participantAvatarName(other))}
          <span
            className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-[var(--bg-base)] ${
              otherOnline
                ? "bg-[var(--online)]"
                : "border border-[var(--text-muted)] bg-[var(--bg-surface)]"
            }`}
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--text-primary)]">
            {otherName}
          </p>
          <p className="truncate text-[12px] text-[var(--text-muted)]">
            <StatusText online={otherOnline} />
          </p>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={(e) => {
          if (e.currentTarget.scrollTop <= 8) loadOlder();
        }}
        className="t-scroll mt-12 flex-1 overflow-y-auto px-4 py-4"
      >
        {loadingHistory && (
          <p className="py-2 text-center text-[12px] text-[var(--text-muted)]">
            Loading…
          </p>
        )}
        <div
          key={convId}
          className="t-panel-in mx-auto flex max-w-3xl flex-col"
        >
          {messages.map((m, i) => {
            const mine = m.senderId === userId;
            const receipt = receiptState(m, userId, otherId);
            const prev = i > 0 ? messages[i - 1] : null;
            const next = i < messages.length - 1 ? messages[i + 1] : null;
            const grouped =
              !!prev &&
              prev.senderId === m.senderId &&
              !m.isDeleted &&
              !prev.isDeleted &&
              new Date(m.createdAt).getTime() -
                new Date(prev.createdAt).getTime() <=
                GROUP_WINDOW_MS;
            const groupLast =
              !next ||
              next.senderId !== m.senderId ||
              m.isDeleted ||
              next.isDeleted ||
              new Date(next.createdAt).getTime() -
                new Date(m.createdAt).getTime() >
                GROUP_WINDOW_MS;
            return (
              <div
                key={m.id}
                className={`t-msg-in group flex flex-col ${mine ? "items-end" : "items-start"} ${
                  i === 0 ? "" : grouped ? "mt-0.5" : "mt-2"
                }`}
              >
                <MessageBubble
                  message={m}
                  mine={mine}
                  showTail={groupLast}
                  showMeta={groupLast}
                  reactionOpen={reactionFor === m.id}
                  isEditing={editingId === m.id}
                  editText={editText}
                  onEditTextChange={setEditText}
                  onSaveEdit={() => saveEdit(m.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onToggleReactionPicker={() =>
                    setReactionFor(reactionFor === m.id ? null : m.id)
                  }
                  onReact={(emoji) => toggleReaction(m.id, emoji)}
                  onEdit={() => {
                    setEditingId(m.id);
                    setEditText(m.content);
                  }}
                  onDelete={() => removeMessage(m.id)}
                  onRetry={() => retry(m.tempId)}
                  receipt={receipt}
                />
              </div>
            );
          })}
          {typing && (
            <div className="flex items-center gap-2 px-1 text-[12px] text-[var(--text-muted)]">
              <span className="flex gap-1">
                <span className="size-1.5 animate-pulse rounded-full bg-[var(--text-muted)]" />
                <span className="size-1.5 animate-pulse rounded-full bg-[var(--text-muted)] [animation-delay:150ms]" />
                <span className="size-1.5 animate-pulse rounded-full bg-[var(--text-muted)] [animation-delay:300ms]" />
              </span>
              {otherName} is typing…
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-[var(--border)] p-3">
        <div className="relative mx-auto flex max-w-3xl items-end gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1.5">
          <button
            ref={emojiBtnRef}
            type="button"
            aria-label="Add emoji"
            aria-expanded={showEmoji}
            onClick={() => setShowEmoji((v) => !v)}
            className="relative flex size-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors duration-200 hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
          >
            <Smile className="h-5 w-5" />
            {showEmoji && (
              <EmojiPicker
                onSelect={(emoji) => insertEmoji(emoji)}
                onClose={() => setShowEmoji(false)}
                ignoreRef={emojiBtnRef}
              />
            )}
          </button>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              emitTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Type a message…"
            aria-label="Message"
            rows={1}
            className="max-h-40 min-h-[40px] w-full resize-none bg-transparent py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
          />
          <button
            type="button"
            onClick={send}
            disabled={!text.trim()}
            className="shrink-0 rounded-lg bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--on-accent)] transition-[filter,opacity] duration-200 hover:brightness-110 active:brightness-95 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatPanel;
