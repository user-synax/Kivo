"use client";

import {
  Hash,
  Loader2,
  MessageCircle,
  Search,
  SearchX,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/dashboard/avatar";
import { RichEmptyState } from "@/components/ui/empty-state";
import { apiGet } from "@/lib/api";

const EASE = [0.22, 1, 0.36, 1];

function SearchSection({ label, icon: Icon, items, loading, emptyMessage, renderItem }) {
  if (loading) {
    return (
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
          <span>Searching {label.toLowerCase()}…</span>
        </div>
      </div>
    );
  }
  if (!items || items.length === 0) return null;
  return (
    <div className="py-1">
      <div className="flex items-center gap-2 px-4 py-1.5">
        <Icon className="h-3.5 w-3.5 text-[var(--text-muted)]" strokeWidth={1.8} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {label}
        </span>
      </div>
      {items.map((item, i) => (
        <motion.div
          key={item.id || i}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15, delay: i * 0.02, ease: EASE }}
        >
          {renderItem(item, i)}
        </motion.div>
      ))}
    </div>
  );
}

function MessageResult({ item, onClick }) {
  const snippet = item.content
    ? item.content.length > 120
      ? item.content.slice(0, 120) + "…"
      : item.content
    : "";
  const convName = item.conversationName || "Conversation";
  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-[var(--hover)]"
    >
      <Avatar
        name={item.senderName}
        url={item.senderAvatarUrl}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] font-medium text-[var(--text-primary)]">
            {item.senderName}
          </span>
          <span className="truncate text-[11px] text-[var(--text-muted)]">
            in {convName}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-[var(--text-muted)]">
          {snippet}
        </p>
      </div>
      <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]/50" strokeWidth={1.5} />
    </button>
  );
}

function UserResult({ item, onClick }) {
  const name = item.displayName || item.username || "Unknown";
  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-[var(--hover)]"
    >
      <Avatar
        name={name}
        avatarStyle={item.avatarStyle}
        url={item.avatarUrl}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">
          {name}
        </p>
        {item.username && (
          <p className="truncate text-[11px] text-[var(--text-muted)]">
            @{item.username}
          </p>
        )}
      </div>
      <Users className="h-4 w-4 shrink-0 text-[var(--text-muted)]/50" strokeWidth={1.5} />
    </button>
  );
}

function SpaceResult({ item, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-[var(--hover)]"
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border)]">
        <Hash className="h-4 w-4 text-[var(--text-muted)]" strokeWidth={1.5} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">
          {item.name}
        </p>
        <p className="truncate text-[11px] text-[var(--text-muted)]">
          {item.category} · {item.channelCount || 0} channel{(item.channelCount || 0) !== 1 ? "s" : ""}
        </p>
      </div>
    </button>
  );
}

export function SearchOverlay({ open, onClose, onSelectMessage, onSelectUser, onSelectSpace }) {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingSpaces, setLoadingSpaces] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const reduce = useReducedMotion();

  // Focus input on open
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setQuery("");
      setMessages([]);
      setUsers([]);
      setSpaces([]);
      setHasSearched(false);
    }
  }, [open]);

  const doSearch = useCallback((q) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setMessages([]);
      setUsers([]);
      setSpaces([]);
      setHasSearched(false);
      return;
    }

    setHasSearched(true);
    const encoded = encodeURIComponent(trimmed);

    // Fire all three searches in parallel
    setLoadingMessages(true);
    setLoadingUsers(true);
    setLoadingSpaces(true);

    apiGet(`/api/v1/search?q=${encoded}&limit=5`)
      .then((data) => {
        setMessages(data?.messages || []);
        setUsers(data?.users || []);
        setSpaces(data?.spaces || []);
      })
      .catch(() => {
        setMessages([]);
        setUsers([]);
        setSpaces([]);
      })
      .finally(() => {
        setLoadingMessages(false);
        setLoadingUsers(false);
        setLoadingSpaces(false);
      });
  }, []);

  const handleInputChange = useCallback(
    (e) => {
      const val = e.target.value;
      setQuery(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSearch(val), 300);
    },
    [doSearch]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleMessageClick = useCallback(
    (item) => {
      onSelectMessage?.(item);
      onClose();
    },
    [onSelectMessage, onClose]
  );

  const handleUserClick = useCallback(
    (item) => {
      onSelectUser?.(item);
      onClose();
    },
    [onSelectUser, onClose]
  );

  const handleSpaceClick = useCallback(
    (item) => {
      onSelectSpace?.(item);
      onClose();
    },
    [onSelectSpace, onClose]
  );

  const anyLoading = loadingMessages || loadingUsers || loadingSpaces;
  const anyResults =
    (messages && messages.length > 0) ||
    (users && users.length > 0) ||
    (spaces && spaces.length > 0);
  const showEmpty = hasSearched && !anyLoading && !anyResults;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="search-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2, ease: EASE }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
          />

          {/* Overlay */}
          <motion.div
            key="search-overlay"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.97, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.98, filter: "blur(4px)" }}
            transition={{ duration: reduce ? 0.15 : 0.25, ease: EASE }}
            className="fixed left-1/2 top-[15%] z-[101] w-full max-w-lg -translate-x-1/2 px-4"
          >
            <div className="flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-[0_24px_80px_-12px_rgba(0,0,0,0.6)]">
              {/* Search input */}
              <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
                <Search className="h-5 w-5 shrink-0 text-[var(--text-muted)]" strokeWidth={1.8} />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={handleInputChange}
                  placeholder="Search messages, people, spaces…"
                  aria-label="Global search"
                  className="w-full min-w-0 bg-transparent text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") onClose();
                  }}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setMessages([]);
                      setUsers([]);
                      setSpaces([]);
                      setHasSearched(false);
                      inputRef.current?.focus();
                    }}
                    aria-label="Clear search"
                    className="flex size-6 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                )}
                <kbd className="hidden shrink-0 sm:inline-flex items-center gap-0.5 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-[11px] text-[var(--text-muted)]">
                  esc
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
                {!hasSearched && !anyLoading && (
                  <RichEmptyState
                    icon={Search}
                    title="Start typing to search…"
                    hint="Messages, people, and spaces"
                  />
                )}

                {anyLoading && !anyResults && (
                  <div className="flex items-center justify-center gap-2 px-4 py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)]" strokeWidth={2} />
                    <span className="text-[13px] text-[var(--text-muted)]">Searching…</span>
                  </div>
                )}

                {showEmpty && (
                  <RichEmptyState
                    icon={SearchX}
                    title={`No results for "${query}"`}
                    hint="Try a different search term"
                  />
                )}

                {anyResults && (
                  <div className="py-1">
                    <SearchSection
                      label="Messages"
                      icon={MessageCircle}
                      items={messages}
                      loading={loadingMessages}
                      emptyMessage=""
                      renderItem={(item) => (
                        <MessageResult item={item} onClick={handleMessageClick} />
                      )}
                    />
                    <SearchSection
                      label="People"
                      icon={Users}
                      items={users}
                      loading={loadingUsers}
                      emptyMessage=""
                      renderItem={(item) => (
                        <UserResult item={item} onClick={handleUserClick} />
                      )}
                    />
                    <SearchSection
                      label="Spaces"
                      icon={Hash}
                      items={spaces}
                      loading={loadingSpaces}
                      emptyMessage=""
                      renderItem={(item) => (
                        <SpaceResult item={item} onClick={handleSpaceClick} />
                      )}
                    />
                  </div>
                )}
              </div>

              {/* Footer hint */}
              {anyResults && (
                <div className="border-t border-[var(--border)] px-4 py-2">
                  <p className="text-[11px] text-[var(--text-muted)]/60">
                    ↑↓ to navigate · ↵ to select · esc to close
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default SearchOverlay;
