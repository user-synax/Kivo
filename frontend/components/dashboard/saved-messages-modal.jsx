"use client";

import { Bookmark, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/dashboard/avatar";
import { apiGet } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { formatTime, otherParticipant, participantName } from "@/lib/chat";
import { messageText } from "@/lib/clipboard";

// Saved messages: every message the current user bookmarked across chats,
// newest save first. Clicking a row jumps to that conversation and highlights
// the message (same flow as Ctrl+K search results).
export function SavedMessagesModal({ open, onClose, onJump }) {
  const [items, setItems] = useState([]);
  const [convs, setConvs] = useState([]);
  const [loading, setLoading] = useState(false);
  const userId = getSession()?.id;

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    Promise.all([
      apiGet("/api/v1/messages/saved"),
      apiGet("/api/v1/conversations"),
    ])
      .then(([saved, list]) => {
        if (!active) return;
        setItems(Array.isArray(saved) ? saved : []);
        setConvs(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (active) {
          setItems([]);
          setConvs([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  const convById = {};
  for (const c of convs) convById[c.id] = c;

  // The overlay only exists while open — otherwise an always-mounted modal
  // would sit permanently on top of the app.
  if (!open) return null;

  const describe = (message) => {
    const c = convById[message?.conversationId];
    if (!c) return { label: "Unknown chat", avatar: null, sub: null };
    const dmOther = c.type === "dm" ? otherParticipant(c, userId) : null;
    const avatar = dmOther
      ? { url: dmOther.avatarUrl, style: dmOther.avatarStyle }
      : { url: c.avatarUrl, style: null };
    return {
      label: participantName(dmOther || c) || c.name || "Chat",
      avatar,
      sub: c.type === "dm" ? "Direct message" : c.type === "group" ? `${c.participants?.length || 0} members` : "Space channel",
    };
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Saved messages"
    >
      <button
        type="button"
        aria-label="Close saved messages"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
      />
      <div className="relative flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl sm:rounded-2xl">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-base)] px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Bookmark className="h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden />
            <h2 className="truncate font-sans text-[14px] font-semibold text-[var(--text-primary)]">
              Saved messages
            </h2>
            {!loading && items.length > 0 && (
              <span className="text-[12px] text-[var(--text-muted)]">
                · {items.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="kivo-focus flex size-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-[var(--text-muted)]">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              <span className="text-[13px]">Loading…</span>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-6 py-12 text-center">
              <Bookmark className="h-7 w-7 text-[var(--text-muted)]" aria-hidden />
              <p className="text-[13px] font-medium text-[var(--text-primary)]">
                Nothing saved yet
              </p>
              <p className="max-w-[260px] text-[12px] text-[var(--text-muted)]">
                Open the menu on any message (right-click / long-press) and pick
                “Save message” — quotes, links, and files you want to find again.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col">
              {items.map(({ message, savedAt }) => {
                const info = describe(message);
                const text = messageText(message);
                return (
                  <li key={message.id} className="border-b border-[var(--border)] last:border-0">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onJump?.(message);
                      }}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--hover)]"
                    >
                      <span className="mt-0.5 shrink-0">
                        <Avatar
                          name={info.label}
                          url={info.avatar?.url}
                          avatarStyle={info.avatar?.style}
                          size="sm"
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                            {info.label}
                          </span>
                          {savedAt && (
                            <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
                              {formatTime(savedAt)}
                            </span>
                          )}
                        </span>
                        {text && (
                          <span className="mt-0.5 block whitespace-pre-wrap break-words text-[12.5px] text-[var(--text-secondary)] [overflow-wrap:anywhere] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                            {text}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
