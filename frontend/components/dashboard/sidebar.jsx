"use client";

import {
  ChevronDown,
  Compass,
  Hash,
  Layers,
  Megaphone,
  PanelLeft,
  Pencil,
  Plus,
  Search,
  SearchCode,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Avatar } from "@/components/dashboard/avatar";
import { ProfileEditModal } from "@/components/dashboard/profile-edit-modal";
import { useTheme } from "@/components/theme-provider";
import { useIsDesktop } from "@/lib/use-breakpoint";

// Restrained, no-bounce easing shared across every micro-interaction.
const EASE = "cubic-bezier(0.22,1,0.36,1)";

function EmptyState({ message }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-[13px] text-[var(--text-muted)]">{message}</p>
    </div>
  );
}

function ConversationItem({ conversation, selected, onSelect, index }) {
  const { name, lastMessage, time, unread, online, type } = conversation;
  const isGroup = type === "group";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      style={{ animationDelay: `${Math.min(index, 12) * 28}ms` }}
      className={`group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors duration-200 ease-[${EASE}] motion-reduce:animate-none animate-[t-item-in_0.4s_${EASE}_both] hover:cursor-pointer ${
        selected ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--hover)]"
      }`}
    >
      <div className="relative shrink-0">
        <Avatar
          name={name}
          selected={selected}
          online={online && !isGroup}
          avatarStyle={conversation.avatarStyle}
          url={conversation.avatarUrl}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-[var(--text-primary)]">
            {name}
          </span>
          {time && (
            <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
              {time}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] text-[var(--text-muted)]">
            {lastMessage || (isGroup ? "Group conversation" : "")}
          </span>
          {unread > 0 && (
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[11px] font-semibold text-[var(--on-accent)]">
              {unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function ConversationSection({ label, items, selectedId, onSelect, baseIndex = 0, collapsed, onNewGroup }) {
  if (!items.length) return null;
  return (
    <div className="mb-1">
      {!collapsed && (
        <div className="flex items-center justify-between px-3 pb-1 pt-3">
          <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {label}
          </span>
          {onNewGroup && (
            <button
              type="button"
              onClick={onNewGroup}
              aria-label="New group"
              className="kivo-focus flex size-6 items-center justify-center rounded-full text-[var(--text-muted)] hover:cursor-pointer transition-colors duration-200 ease-[${EASE}] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
            </button>
          )}
        </div>
      )}
      {items.map((c, i) => (
        <ConversationItem
          key={c.id}
          conversation={c}
          selected={c.id === selectedId}
          onSelect={() => onSelect(c.id)}
          index={baseIndex + i}
        />
      ))}
    </div>
  );
}

function SpacesSection({ spaces, channels, selectedId, onSelect, collapsed, onCreateSpace }) {
  const SPACES_EXPANDED_KEY = "kivo:spaces-expanded";
  const [expanded, setExpanded] = useState({});
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SPACES_EXPANDED_KEY);
      if (saved) setExpanded(JSON.parse(saved));
    } catch {}
    hasLoadedRef.current = true;
  }, []);
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    try {
      localStorage.setItem(SPACES_EXPANDED_KEY, JSON.stringify(expanded));
    } catch {}
  }, [expanded]);
  const toggle = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  // default collapsed = true; only explicitly true is expanded (persists across refresh)
  const isExpanded = (id) => expanded[id] === true;

  if (collapsed) return null;

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between px-3 pb-1 pt-3">
        <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Spaces</span>
        {onCreateSpace && (
          <button
            type="button"
            onClick={onCreateSpace}
            aria-label="New space"
            className="kivo-focus flex size-6 items-center justify-center rounded-full text-[var(--text-muted)] hover:cursor-pointer transition-colors duration-200 ease-[${EASE}] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
          </button>
        )}
      </div>

      {!spaces?.length ? (
        <div className="px-3 py-4 text-center">
          <p className="text-[12px] text-[var(--text-muted)]">No spaces yet</p>
          <button type="button" onClick={onCreateSpace} className="mt-2 text-[12px] font-medium text-[var(--accent)] hover:underline hover:cursor-pointer">Create a space</button>
        </div>
      ) : (
        <div className="space-y-1">
          {spaces.map((space) => {
            const spaceChannels = channels.filter((c) => c.spaceId === space.id);
            const expandedOpen = isExpanded(space.id);
            return (
              <div key={space.id} className="rounded-xl px-1">
                <button
                  type="button"
                  onClick={() => toggle(space.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors duration-200 ease-[${EASE}] hover:cursor-pointer hover:bg-[var(--hover)]"
                >
                  <Avatar name={space.name} url={space.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium leading-tight text-[var(--text-primary)]">{space.name}</p>
                    <p className="truncate text-[11px] leading-tight text-[var(--text-muted)]">{space.category} • {spaceChannels.length} channel{spaceChannels.length !== 1 ? "s" : ""}</p>
                  </div>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform duration-200 ease-[${EASE}] ${expandedOpen ? "rotate-0" : "-rotate-90"}`} />
                </button>

                <AnimatePresence initial={false}>
                  {expandedOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="ml-3 mt-1 space-y-0.5 border-l border-[var(--border)] pl-3">
                        {spaceChannels.length === 0 ? (
                          <p className="px-2 py-1 text-[11px] text-[var(--text-muted)]">No channels</p>
                        ) : (
                          spaceChannels.map((c) => {
                            const selected = c.id === selectedId;
                            const isAnnouncement = c.name?.toLowerCase().includes("announce");
                            const Icon = isAnnouncement ? Megaphone : Hash;
                            const displayName = c.name.includes("/") ? c.name.split("/").pop().trim() : c.name;
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => onSelect(c.id)}
                                aria-current={selected ? "true" : undefined}
                                className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left transition-colors duration-150 hover:cursor-pointer ${selected ? "bg-[var(--accent-soft)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"}`}
                              >
                                <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
                                <span className="min-w-0 flex-1 truncate text-[12px] font-medium leading-tight">{displayName.replace(/^#/, "")}</span>
                                {c.unread > 0 && (
                                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-semibold text-[var(--on-accent)]">{c.unread > 9 ? "9+" : c.unread}</span>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProfileNav({ currentUser, onEditProfile, collapsed }) {
  if (!currentUser) return null;
  const label = currentUser.displayName || currentUser.email || "Account";

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onEditProfile}
        aria-label="Edit profile"
        className="flex w-full justify-center border-t border-[var(--border)] p-2 transition-colors duration-200 ease-[${EASE}] hover:bg-[var(--hover)]"
      >
        <Avatar
          name={label}
          avatarStyle={currentUser.avatarStyle}
          url={currentUser.avatarUrl}
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onEditProfile}
      aria-label="Edit profile"
      className="group flex w-full items-center gap-3 border-t border-[var(--border)] px-3 py-3 text-left transition-colors duration-200 ease-[${EASE}] hover:bg-[var(--hover)]"
    >
      <Avatar
        name={label}
        avatarStyle={currentUser.avatarStyle}
        url={currentUser.avatarUrl}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--text-primary)]">
          {label}
        </p>
        <p className="truncate text-[12px] text-[var(--text-muted)]">
          {currentUser.email}
        </p>
      </div>
      <Pencil
        className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] opacity-0 transition-opacity duration-200 ease-[${EASE}] group-hover:opacity-100"
        strokeWidth={1.6}
      />
    </button>
  );
}

function ThemeSwitcher({ collapsed }) {
  const { themeId, themes, setThemeId } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const current = themes.find((t) => t.id === themeId) || themes[0];

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (collapsed) {
    return (
      <div className="relative border-t border-[var(--border)] p-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Change theme"
          className="kivo-focus mx-auto block size-8 rounded-full ring-1 ring-[var(--border)] transition-transform duration-200 ease-[${EASE}] hover:scale-105"
          style={{ background: current.swatch }}
        />
        {open && (
          <div className="absolute bottom-full left-2 mb-2 w-44 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-1 shadow-xl">
            {themes.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setThemeId(t.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors duration-150 hover:bg-[var(--hover)] ${
                  t.id === themeId
                    ? "text-[var(--text-primary)]"
                    : "text-[var(--text-muted)]"
                }`}
              >
                <span
                  className="size-4 shrink-0 rounded-full ring-1 ring-[var(--border)]"
                  style={{ background: t.swatch }}
                />
                <span className="flex-1 truncate">{t.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative border-t border-[var(--border)] px-3 py-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Change theme"
        className="kivo-focus flex w-full items-center gap-2 rounded-[var(--radius-inputs)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-[13px] text-[var(--text-primary)] transition-colors duration-200 ease-[${EASE}] hover:bg-[var(--hover)]"
      >
        <span
          className="size-4 shrink-0 rounded-full ring-1 ring-[var(--border)]"
          style={{ background: current.swatch }}
        />
        <span className="flex-1 text-left">Theme</span>
        <span className="text-[var(--text-muted)]">{current.label}</span>
      </button>

      {open && (
        <div className="absolute bottom-full left-3 right-3 mb-2 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-1 shadow-xl">
          {themes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setThemeId(t.id);
                setOpen(false);
              }}
              role="menuitemradio"
              aria-checked={t.id === themeId}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] transition-colors duration-150 hover:bg-[var(--hover)] ${
                t.id === themeId
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-muted)]"
              }`}
            >
              <span
                className="size-5 shrink-0 rounded-full ring-1 ring-[var(--border)]"
                style={{ background: t.swatch }}
              />
              <span className="flex-1 truncate">{t.label}</span>
              {t.id === themeId && (
                <span className="size-2 shrink-0 rounded-full bg-[var(--accent)]" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NewMenu({ onFriends, onGroup, onSpace, onDiscover, collapsed }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (collapsed) return null;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="New chat"
        className="kivo-focus hover:cursor-pointer group flex h-9 items-center gap-1.5 rounded-full bg-accent pl-3.5 pr-1.5 text-[13px] font-medium text-(--on-accent) transition-[transform,filter] duration-200 ease-[${EASE}] hover:brightness-110"
      >
        <span>New</span>
        <span className="flex size-6 items-center justify-center rounded-full bg-white/20 transition-transform duration-200 ease-[${EASE}]">
          <Plus className="h-5 w-5" strokeWidth={2} />
        </span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="New"
          className="absolute right-0 top-full z-30 mt-2 min-w-56 origin-top-right overflow-hidden rounded-xl border border-border bg-card p-1.5 text-foreground shadow-xl outline-none"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onFriends?.();
            }}
            className="relative isolate flex w-full select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] outline-none transition-colors duration-150 hover:bg-foreground/[0.065] focus-visible:bg-foreground/[0.065] focus-visible:ring-2 focus-visible:ring-foreground/15"
          >
            <UserPlus className="h-4 w-4" />
            Friends
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onGroup?.();
            }}
            className="relative isolate flex w-full select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] outline-none transition-colors duration-150 hover:bg-foreground/[0.065] focus-visible:bg-foreground/[0.065] focus-visible:ring-2 focus-visible:ring-foreground/15"
          >
            <Users className="h-4 w-4" />
            Group
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSpace?.();
            }}
            className="relative isolate flex w-full select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] outline-none transition-colors duration-150 hover:bg-foreground/[0.065] focus-visible:bg-foreground/[0.065] focus-visible:ring-2 focus-visible:ring-foreground/15"
          >
            <Layers className="h-4 w-4" />
            Space
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onDiscover?.();
            }}
            className="relative isolate flex w-full select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] outline-none transition-colors duration-150 hover:bg-foreground/[0.065] focus-visible:bg-foreground/[0.065] focus-visible:ring-2 focus-visible:ring-foreground/15"
          >
            <Compass className="h-4 w-4" />
            Discover Spaces
          </button>
        </div>
      )}
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
  onNewGroup,
  onCreateSpace,
  onDiscoverSpaces,
  spaces,
  currentUser,
  onProfileUpdate,
  notificationBell = null,
  hideSpaces = false,
  hideGroups = false,
  hideDMs = false,
  isOffline = false,
  onSearchOpen,
}) {
  const isDesktop = useIsDesktop();
  const [profileOpen, setProfileOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      (c.name || "").toLowerCase().includes(q),
    );
  }, [conversations, query]);

  const dms = useMemo(
    () => filtered.filter((c) => c.type === "dm"),
    [filtered],
  );
  const groups = useMemo(
    () => filtered.filter((c) => c.type === "group"),
    [filtered],
  );
  const channels = useMemo(
    () => filtered.filter((c) => c.type === "space_channel"),
    [filtered],
  );

  const router = useRouter();
  const pathname = usePathname();


  return (
    <div className="flex h-full min-w-0 flex-col bg-(--bg-elevated) pt-[max(env(safe-area-inset-top),1rem)]">
      {/* Header */}
      <div
        className={`flex shrink-0 items-center gap-2 ${
          collapsed
            ? "flex-col px-3 py-3"
            : "justify-between border-b border--border px-5 py-3.5"
        }`}
      >
        {!collapsed && (
          <span className="truncate font-display text-3xl font-semibold tracking-tight text-(--text-primary)">
            Chats
          </span>
        )}

        <div className="flex shrink-0 items-center gap-1.5">
          {notificationBell}
          {onSearchOpen && (
            <button
              type="button"
              onClick={onSearchOpen}
              aria-label="Search"
              title="Search (Ctrl+K)"
              className="kivo-focus flex size-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] transition-colors duration-200 ease-[${EASE}] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
            >
              <SearchCode className="h-5 w-5" strokeWidth={1.6} />
            </button>
          )}
          {onCompose && (
            <NewMenu
              onFriends={onCompose}
              onGroup={onNewGroup}
              onSpace={onCreateSpace}
              onDiscover={onDiscoverSpaces}
              collapsed={collapsed}
            />
          )}
        </div>
      </div>

      {/* Offline banner */}
      {!collapsed && isOffline && (
        <div className="mx-3 mt-2 flex items-center gap-2 rounded-lg border border-[var(--destructive)]/20 bg-[var(--destructive)]/8 px-3 py-2">
          <span className="size-2 shrink-0 rounded-full bg-[var(--destructive)] animate-pulse" />
          <span className="text-[12px] font-medium text-[var(--destructive)]">You are offline</span>
        </div>
      )}

      {/* Search */}
      {!collapsed && (
        <div className="shrink-0 px-3 py-3">
          <label className="flex items-center gap-2 rounded-[var(--radius-inputs)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 transition-colors duration-200 ease-[${EASE}] focus-within:border-[var(--accent)]">
            <Search
              className="h-4 w-4 shrink-0 text-[var(--text-muted)]"
              strokeWidth={1.6}
              aria-hidden="true"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search friends"
              aria-label="Search friends"
              className="w-full min-w-0 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="flex size-5 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
              >
                <X className="h-3 w-3" strokeWidth={2} />
              </button>
            )}
          </label>
        </div>
      )}

      {/* Conversation list */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y px-2 py-1.5" style={{ overscrollBehavior: "contain" }}>
        {conversations.length === 0 ? (
          <EmptyState message="No conversations yet" />
        ) : filtered.length === 0 ? (
          <EmptyState message={`No friends match “${query.trim()}”`} />
        ) : (
          <>
            {!hideDMs && (
              <ConversationSection
                label="Direct Messages"
                items={dms}
                selectedId={selectedId}
                onSelect={onSelect}
                collapsed={collapsed}
              />
            )}
            {!hideGroups && (
              <ConversationSection
                label="Groups"
                items={groups}
                selectedId={selectedId}
                onSelect={onSelect}
                collapsed={collapsed}
                onNewGroup={onNewGroup}
              />
            )}
            {!hideSpaces && (
              <SpacesSection
                spaces={spaces}
                channels={channels}
                selectedId={selectedId}
                onSelect={onSelect}
                collapsed={collapsed}
                onCreateSpace={onCreateSpace}
              />
            )}
          </>
        )}
      </div>

      {/* Footer — theme + profile (hidden on mobile; lives in Profile tab) */}
      {isDesktop && (
        <>
          <ThemeSwitcher collapsed={collapsed} />
          <ProfileNav
            currentUser={currentUser}
            onEditProfile={() => setProfileOpen(true)}
            collapsed={collapsed}
          />
        </>
      )}

      <ProfileEditModal
        open={profileOpen}
        currentUser={currentUser}
        onClose={() => setProfileOpen(false)}
        onSaved={() => onProfileUpdate?.()}
      />
    </div>
  );
}

export default Sidebar;
