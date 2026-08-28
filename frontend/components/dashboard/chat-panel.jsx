"use client";

import { useEffect, useRef, useState } from "react";
import { useSocket } from "@/components/socket-provider";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { getSession } from "@/lib/auth";
import {
  formatTime,
  otherParticipant,
  participantAvatarName,
  participantName,
} from "@/lib/chat";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const TYPING_IDLE_MS = 1500;

function initials(name) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
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
        <div className="relative flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-sm font-medium text-[var(--text-primary)]">
          {initials(participantAvatarName(other))}
          {otherOnline && (
            <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-[var(--online)] ring-2 ring-[var(--bg-base)]" />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--text-primary)]">
            {otherName}
          </p>
          <p className="truncate text-[12px] text-[var(--text-muted)]">
            {otherOnline ? "Online" : "Offline"}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={(e) => {
          if (e.currentTarget.scrollTop <= 8) loadOlder();
        }}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {loadingHistory && (
          <p className="py-2 text-center text-[12px] text-[var(--text-muted)]">
            Loading…
          </p>
        )}
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          {messages.map((m) => {
            const mine = m.senderId === userId;
            const receipt = receiptState(m, userId, otherId);
            return (
              <div
                key={m.id}
                className={`group flex flex-col ${mine ? "items-end" : "items-start"}`}
              >
                <div
                  className={`relative max-w-[75%] rounded-2xl px-4 py-2.5 text-sm text-[var(--text-primary)] ${
                    mine
                      ? "rounded-tr-md bg-[var(--bubble-sent)]"
                      : "rounded-tl-md border border-[var(--border)] bg-[var(--bubble-received)]"
                  }`}
                >
                  {editingId === m.id ? (
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          saveEdit(m.id);
                        }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="w-full bg-transparent text-sm text-[var(--text-primary)] focus:outline-none"
                      rows={2}
                    />
                  ) : m.isDeleted ? (
                    <span className="italic text-[var(--text-muted)]">
                      This message was deleted
                    </span>
                  ) : (
                    <span className="whitespace-pre-wrap break-words">
                      {m.content}
                    </span>
                  )}

                  {/* Hover actions */}
                  {!m.isDeleted && editingId !== m.id && (
                    <div
                      className={`absolute -top-3 ${
                        mine
                          ? "left-0 -translate-x-full"
                          : "right-0 translate-x-full"
                      } hidden items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-1 py-0.5 group-hover:flex`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setReactionFor(reactionFor === m.id ? null : m.id)
                        }
                        aria-label="React"
                        className="flex size-6 items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      >
                        ☺
                      </button>
                      {mine && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(m.id);
                            setEditText(m.content);
                          }}
                          aria-label="Edit"
                          className="flex size-6 items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        >
                          ✎
                        </button>
                      )}
                      {mine && (
                        <button
                          type="button"
                          onClick={() => removeMessage(m.id)}
                          aria-label="Delete"
                          className="flex size-6 items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  )}

                  {/* Reaction picker */}
                  {reactionFor === m.id && (
                    <div
                      className={`absolute bottom-full z-10 mb-1 flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1 ${
                        mine ? "right-0" : "left-0"
                      }`}
                    >
                      {EMOJIS.map((e) => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => toggleReaction(m.id, e)}
                          className="rounded px-1 text-base hover:bg-[var(--hover)]"
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Meta: time + receipt + reactions + failed retry */}
                <div
                  className={`mt-1 flex items-center gap-1.5 px-1 text-[11px] text-[var(--text-muted)]`}
                >
                  <span>{formatTime(m.createdAt)}</span>
                  {m.isEdited && <span>· edited</span>}
                  {m.status === "failed" && (
                    <button
                      type="button"
                      onClick={() => retry(m.tempId)}
                      className="text-[var(--accent)] hover:underline"
                    >
                      failed · retry
                    </button>
                  )}
                  {receipt === "sent" && <span>✓</span>}
                  {receipt === "delivered" && <span>✓✓</span>}
                  {receipt === "read" && (
                    <span className="text-[var(--accent)]">✓✓</span>
                  )}

                  {/* Reaction chips */}
                  {m.reactions && m.reactions.length > 0 && (
                    <div className="ml-1 flex flex-wrap gap-1">
                      {Object.entries(
                        m.reactions.reduce((acc, r) => {
                          acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                          return acc;
                        }, {}),
                      ).map(([emoji, count]) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => toggleReaction(m.id, emoji)}
                          className="rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-[11px] hover:bg-[var(--hover)]"
                        >
                          {emoji} {count}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2">
          <textarea
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
            className="max-h-32 w-full resize-none bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
          />
          <button
            type="button"
            onClick={send}
            disabled={!text.trim()}
            className="shrink-0 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-[var(--on-accent)] transition-opacity duration-200 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatPanel;
