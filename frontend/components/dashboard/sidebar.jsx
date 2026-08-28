"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { PanelLeft } from "lucide-react";

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

function Avatar({ name, selected, online }) {
  return (
    <div
      className={`relative flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-sm font-medium ${
        selected
          ? "bg-[var(--accent)] text-[var(--on-accent)]"
          : "bg-[var(--bg-surface)] text-[var(--text-primary)]"
      }`}
    >
      {initials(name)}
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-[var(--online)] ring-2 ring-[var(--bg-elevated)]" />
      )}
    </div>
  );
}

function ConversationItem({ conversation, selected, collapsed, onSelect }) {
  const { name, lastMessage, time, unread, online } = conversation;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={`group relative hover:cursor-pointer flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--hover)] ${
        selected ? "bg-[var(--hover)]" : ""
      } ${collapsed ? "justify-center" : ""}`}
    >
      {selected && (
        <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-[var(--accent)]" />
      )}

      <div className="relative shrink-0">
        <Avatar name={name} selected={selected} online={online} />
        {unread > 0 && collapsed && (
          <span className="t-badge" data-open="true">
            <span className="t-badge-dot size-2.5 rounded-full bg-[var(--unread-badge)] ring-2 ring-[var(--bg-elevated)]" />
          </span>
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
              <span className="t-badge-pop flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--unread-badge)] px-1 text-[11px] font-medium text-[var(--on-accent)]">
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
      className={`flex items-center gap-3 border-t border-[var(--border)] px-3 py-2.5 transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--hover)] ${
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

function ThemeSwitcher({ collapsed }) {
  const { themeId, themes, setThemeId } = useTheme();
  const [phase, setPhase] = useState("closed"); // "open" | "closing" | "closed"
  const wrapRef = useRef(null);
  const closeMs = 150;

  const open = useCallback(() => setPhase("open"), []);
  const close = useCallback(() => {
    setPhase("closing");
    setTimeout(() => setPhase("closed"), closeMs);
  }, []);
  const toggle = () => (phase === "open" ? close() : open());

  useEffect(() => {
    if (phase !== "open") return;
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) close();
    }
    function onKey(e) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [phase, close]);

  const current = themes.find((t) => t.id === themeId) || themes[0];

  const trigger = (
    <button
      type="button"
      onClick={toggle}
      aria-haspopup="menu"
      aria-expanded={phase === "open"}
      aria-label="Change theme"
      className={`kivo-focus flex w-full items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-[13px] text-[var(--text-primary)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--hover)] ${
        collapsed ? "justify-center" : ""
      }`}
    >
      <span
        className="size-4 shrink-0 rounded-full ring-1 ring-[var(--border)]"
        style={{ background: current.swatch }}
      />
      {!collapsed && (
        <>
          <span className="flex-1 text-left">Theme</span>
          <span className="text-[var(--text-muted)]">{current.label}</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className={`text-[var(--text-muted)] transition-transform duration-200 ${
              phase === "open" ? "rotate-180" : ""
            }`}
          >
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </>
      )}
    </button>
  );

  const menu = (
    <div
      className={`t-dropdown ${
        phase === "open" ? "is-open" : phase === "closing" ? "is-closing" : ""
      }`}
      data-origin="bottom-left"
      role="menu"
    >
      <div className="mb-2 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-1 shadow-lg">
        {themes.map((t) => (
          <button
            key={t.id}
            type="button"
            role="menuitemradio"
            aria-checked={t.id === themeId}
            onClick={() => {
              setThemeId(t.id);
              close();
            }}
            className={`flex w-full hover:cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] transition-colors duration-150 hover:bg-[var(--hover)] ${
              t.id === themeId
                ? "text-[var(--text-primary)]"
                : "text-[var(--text-muted)]"
            }`}
          >
            <span
              className="size-5 shrink-0 rounded-full ring-1 ring-[var(--border)]"
              style={{ background: t.swatch }}
            />
            <span className="flex-1">{t.label}</span>
            {t.id === themeId && (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="text-[var(--accent)]"
              >
                <path
                  d="M5 13l4 4L19 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div
      ref={wrapRef}
      className={`relative border-t border-[var(--border)] ${
        collapsed ? "p-2" : "px-3 py-2.5"
      }`}
    >
      {trigger}
      <div
        className={
          collapsed
            ? "absolute bottom-0 left-full ml-2 w-52"
            : "absolute bottom-full left-3 right-3"
        }
      >
        {menu}
      </div>
    </div>
  );
}

export function Sidebar({
  conversations,
  selectedId,
  onSelect,
  collapsed,
  showToggle,
  onToggle,
  onCompose,
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
        <div className={`flex items-center gap-1 ${collapsed ? "" : ""}`}>
          {onCompose && !collapsed && (
            <button
              type="button"
              onClick={onCompose}
              aria-label="New chat"
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
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
          {showToggle && (
            <button
              type="button"
              onClick={onToggle}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="flex size-9 hover:cursor-pointer items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
            >
                <PanelLeft className="w-5 h-5"/>
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
            </button>
          )}
        </div>
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

      {/* Theme switcher + fixed profile nav */}
      <ThemeSwitcher collapsed={collapsed} />
      <ProfileNav currentUser={currentUser} collapsed={collapsed} />
    </div>
  );
}

export default Sidebar;
