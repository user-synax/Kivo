"use client";

import Link from "next/link";

// Conversation list. On desktop it expands (names/previews) or collapses to an
// icon-only avatar rail. On mobile it is always full-width and the toggle is
// hidden (mobile uses stack navigation instead — see dashboard-shell.jsx).
//
// A fixed profile nav is pinned to the bottom: it opens the user profile and
// follows the same expand/collapse state as the rest of the sidebar.

function initials(name) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Avatar({ name, selected }) {
  return (
    <div
      className={`flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-sm font-medium ${
        selected
          ? "bg-[var(--accent)] text-[var(--on-accent)]"
          : "bg-[var(--bg-surface)] text-[var(--text-primary)]"
      }`}
    >
      {initials(name)}
    </div>
  );
}

function ConversationItem({ conversation, selected, collapsed, onSelect }) {
  const { name, lastMessage, time, unread } = conversation;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={`group relative flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--hover)] ${
        selected ? "bg-[var(--hover)]" : ""
      } ${collapsed ? "justify-center" : ""}`}
    >
      {selected && (
        <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-[var(--accent)]" />
      )}

      <div className="relative shrink-0">
        <Avatar name={name} selected={selected} />
        {unread > 0 && collapsed && (
          <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-[var(--unread-badge)] ring-2 ring-[var(--bg-elevated)]" />
        )}
      </div>

      {!collapsed && (
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium text-[var(--text-primary)]">
              {name}
            </span>
            <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
              {time}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[13px] text-[var(--text-muted)]">
              {lastMessage}
            </span>
            {unread > 0 && (
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--unread-badge)] px-1 text-[11px] font-medium text-[var(--on-accent)]">
                {unread}
              </span>
            )}
          </div>
        </div>
      )}
    </button>
  );
}

function ProfileNav({ currentUser, collapsed }) {
  if (!currentUser) return null;
  const label = currentUser.displayName || currentUser.email || "Account";
  return (
    <Link
      href="/app/profile"
      aria-label="Open profile"
      className={`mt-auto flex items-center gap-3 border-t border-[var(--border)] px-3 py-2.5 transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--hover)] ${
        collapsed ? "justify-center" : ""
      }`}
    >
      <Avatar name={label} selected={false} />
      {!collapsed && (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--text-primary)]">
            {label}
          </p>
          <p className="truncate text-[12px] text-[var(--text-muted)]">
            {currentUser.email}
          </p>
        </div>
      )}
    </Link>
  );
}

export function Sidebar({
  conversations,
  selectedId,
  onSelect,
  collapsed,
  showToggle,
  onToggle,
  currentUser,
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div
        className={`flex h-14 shrink-0 items-center gap-2 border-b border-[var(--border)] px-3 ${
          collapsed ? "justify-center" : "justify-between"
        }`}
      >
        {!collapsed && (
          <span className="font-goga text-[18px] font-medium text-[var(--text-primary)]">
            Chats
          </span>
        )}
        {showToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex size-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              {collapsed ? (
                <path
                  d="M4 6h16M4 12h10M4 18h16"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M4 6h16M4 12h16M4 18h16M9 6v12"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-2">
        {conversations.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-[var(--text-muted)]">
            No conversations yet
          </p>
        ) : (
          conversations.map((c) => (
            <ConversationItem
              key={c.id}
              conversation={c}
              selected={c.id === selectedId}
              collapsed={collapsed}
              onSelect={() => onSelect(c.id)}
            />
          ))
        )}
      </div>

      {/* Fixed profile nav */}
      <ProfileNav currentUser={currentUser} collapsed={collapsed} />
    </div>
  );
}

export default Sidebar;
