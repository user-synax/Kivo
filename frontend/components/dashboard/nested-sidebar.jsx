"use client";

import {
  Bookmark,
  ChevronDown,
  Compass,
  Hash,
  Layers,
  Mail,
  Megaphone,
  Plus,
  Search,
  SearchCode,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/dashboard/avatar";
import { ProfileEditModal } from "@/components/dashboard/profile-edit-modal";
import { IconRail } from "@/components/dashboard/icon-rail";
import { SettingsPanel } from "@/components/dashboard/settings-panel";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/motion/context-menu";

const EASE = [0.22, 1, 0.36, 1];
const EASE_STR = "cubic-bezier(0.22,1,0.36,1)";

function EmptyState({ message }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-[13px] text-[var(--text-muted)]">{message}</p>
    </div>
  );
}

function ConversationItem({ conversation, selected, onSelect, onMarkUnread, index }) {
  const { name, lastMessage, time, unread, online, type } = conversation;
  const isGroup = type === "group";
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <button
          type="button"
          onClick={onSelect}
          aria-current={selected ? "true" : undefined}
          style={{ animationDelay: `${Math.min(index, 12) * 28}ms` }}
          className={`group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors duration-200 ease-[${EASE_STR}] motion-reduce:animate-none animate-[t-item-in_0.4s_${EASE_STR}_both] hover:cursor-pointer ${
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
              <span className="truncate text-sm font-medium text-[var(--text-primary)]">{name}</span>
              {time && <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{time}</span>}
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
      </ContextMenuTrigger>
      <ContextMenuContent ariaLabel="Conversation actions">
        <ContextMenuItem onSelect={() => onMarkUnread?.(conversation.id)}>
          <Mail className="h-4 w-4" />
          Mark as unread
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function ChatsList({ items, selectedId, onSelect, onMarkUnread }) {
  if (!items.length) return <EmptyState message="No conversations yet" />;
  return (
    <div className="space-y-0.5">
      {items.map((c, i) => (
        <ConversationItem
          key={c.id}
          conversation={c}
          selected={c.id === selectedId}
          onSelect={() => onSelect(c.id)}
          onMarkUnread={onMarkUnread}
          index={i}
        />
      ))}
    </div>
  );
}

function SpacesList({ spaces, channels, selectedId, onSelect, onCreateSpace }) {
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
  const isExpanded = (id) => expanded[id] === true;

  if (!spaces?.length) {
    return (
      <div className="px-3 py-10 text-center">
        <p className="text-[12px] text-[var(--text-muted)]">No spaces yet</p>
        <button
          type="button"
          onClick={onCreateSpace}
          className="mt-2 text-[12px] font-medium text-[var(--accent)] hover:underline hover:cursor-pointer"
        >
          Create a space
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {spaces.map((space) => {
        const spaceChannels = channels.filter((c) => c.spaceId === space.id);
        const expandedOpen = isExpanded(space.id);
        return (
          <div key={space.id} className="rounded-xl px-1">
            <button
              type="button"
              onClick={() => toggle(space.id)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:cursor-pointer hover:bg-[var(--hover)]"
            >
              <Avatar name={space.name} url={space.avatarUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium leading-tight text-[var(--text-primary)]">{space.name}</p>
                <p className="truncate text-[11px] leading-tight text-[var(--text-muted)]">
                  {space.category} • {spaceChannels.length} channel{spaceChannels.length !== 1 ? "s" : ""}
                </p>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform duration-200 ease-[${EASE_STR}] ${expandedOpen ? "rotate-0" : "-rotate-90"}`}
              />
            </button>
            <AnimatePresence initial={false}>
              {expandedOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: EASE }}
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
                            <span className="min-w-0 flex-1 truncate text-[12px] font-medium leading-tight">
                              {displayName.replace(/^#/, "")}
                            </span>
                            {c.unread > 0 && (
                              <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-semibold text-[var(--on-accent)]">
                                {c.unread > 9 ? "9+" : c.unread}
                              </span>
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
  );
}

function NewMenu({ onFriends, onGroup, onSpace, onDiscover }) {
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
  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="New chat"
        className="kivo-focus hover:cursor-pointer group flex h-9 items-center gap-1.5 rounded-full bg-accent pl-3.5 pr-1.5 text-[13px] font-medium text-(--on-accent) transition-[transform,filter] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:brightness-110"
      >
        <span>New</span>
        <span className="flex size-6 items-center justify-center rounded-full bg-white/20 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]">
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
            <UserPlus className="h-4 w-4" /> Friends
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
            <Users className="h-4 w-4" /> Group
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
            <Layers className="h-4 w-4" /> Space
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
            <Compass className="h-4 w-4" /> Discover Spaces
          </button>
        </div>
      )}
    </div>
  );
}

export function NestedSidebar({
  conversations,
  selectedId,
  onSelect,
  spaces,
  currentUser,
  onProfileUpdate,
  notificationBell = null,
  isOffline = false,
  onSearchOpen,
  onSavedOpen,
  onMarkUnread,
  onCompose,
  onNewGroup,
  onCreateSpace,
  onDiscoverSpaces,
  unread = {},
}) {
  const reduce = useReducedMotion();
  const [activeTab, setActiveTab] = useState("chats");
  const [profileOpen, setProfileOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Reset query when switching tabs? Keep per spec scoped, but retain for simplicity: keep same query but filtered per tab.
  const filteredConversations = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => (c.name || "").toLowerCase().includes(q));
  }, [conversations, query]);

  const chatsItems = useMemo(
    () => filteredConversations.filter((c) => c.type === "dm"),
    [filteredConversations]
  );

  const groupsItems = useMemo(
    () => filteredConversations.filter((c) => c.type === "group"),
    [filteredConversations]
  );

  const channels = useMemo(
    () => filteredConversations.filter((c) => c.type === "space_channel"),
    [filteredConversations]
  );

  const filteredSpaces = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return spaces;
    return (spaces || []).filter((s) => {
      const nameMatch = (s.name || "").toLowerCase().includes(q);
      const catMatch = (s.category || "").toLowerCase().includes(q);
      return nameMatch || catMatch;
    });
  }, [spaces, query]);

  const placeholderByTab = {
    chats: "Search chats",
    groups: "Search groups",
    spaces: "Search spaces",
    settings: "Search settings",
  };

  return (
    <div className="flex h-full min-w-0">
      <IconRail
        activeTab={activeTab}
        onTabChange={setActiveTab}
        currentUser={currentUser}
        onProfileClick={() => setProfileOpen(true)}
        unread={unread}
      />

      {/* Content panel */}
      <div className="flex h-full min-w-0 flex-1 flex-col bg-[var(--bg-elevated)]">
        {/* Header with search + actions */}
        <div className="flex shrink-0 flex-col gap-2 border-b border-[var(--border)] px-3 py-3">
          <div className="flex items-center gap-2">
            {notificationBell && <span className="shrink-0">{notificationBell}</span>}
            {onSavedOpen && (
              <button
                type="button"
                onClick={onSavedOpen}
                aria-label="Saved messages"
                title="Saved messages"
                className="kivo-focus flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
              >
                <Bookmark className="h-5 w-5" strokeWidth={1.6} />
              </button>
            )}
            {onSearchOpen && (
              <button
                type="button"
                onClick={onSearchOpen}
                aria-label="Search"
                title="Search (Ctrl+K)"
                className="kivo-focus flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
              >
                <SearchCode className="h-5 w-5" strokeWidth={1.6} />
              </button>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              {activeTab === "chats" && onCompose && (
                <NewMenu
                  onFriends={onCompose}
                  onGroup={onNewGroup}
                  onSpace={onCreateSpace}
                  onDiscover={onDiscoverSpaces}
                />
              )}
              {activeTab === "groups" && (
                <button
                  type="button"
                  onClick={onNewGroup}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--on-accent)] hover:opacity-90"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                  New group
                </button>
              )}
              {activeTab === "spaces" && (
                <>
                  <button
                    type="button"
                    onClick={onDiscoverSpaces}
                    className="rounded-full border border-[var(--border)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
                  >
                    Discover
                  </button>
                  <button
                    type="button"
                    onClick={onCreateSpace}
                    className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--on-accent)] hover:opacity-90"
                  >
                    New
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Search bar — scoped to active tab. Keep as-is styling. */}
          <label className="flex items-center gap-2 rounded-[var(--radius-inputs)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus-within:border-[var(--accent)]">
            <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" strokeWidth={1.6} aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholderByTab[activeTab] || "Search"}
              aria-label={placeholderByTab[activeTab] || "Search"}
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

          {isOffline && (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--destructive)]/20 bg-[var(--destructive)]/8 px-3 py-2">
              <span className="size-2 shrink-0 animate-pulse rounded-full bg-[var(--destructive)]" />
              <span className="text-[12px] font-medium text-[var(--destructive)]">You are offline</span>
            </div>
          )}
        </div>

        {/* Panel body — exactly one context at a time, with shared easing */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {activeTab === "chats" && (
              <motion.div
                key="chats"
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: -6 }}
                transition={reduce ? { duration: 0 } : { duration: 0.22, ease: EASE }}
                className="h-full overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y px-2 py-1.5"
                style={{ overscrollBehavior: "contain" }}
              >
                {conversations.filter((c) => c.type === "dm").length === 0 ? (
                  <EmptyState message="No chats yet" />
                ) : filteredConversations.length === 0 || chatsItems.length === 0 ? (
                  <EmptyState message={query.trim() ? `No results for “${query.trim()}”` : "No chats yet"} />
                ) : (
                  <ChatsList
                    items={chatsItems}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    onMarkUnread={onMarkUnread}
                  />
                )}
              </motion.div>
            )}
            {activeTab === "groups" && (
              <motion.div
                key="groups"
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: -6 }}
                transition={reduce ? { duration: 0 } : { duration: 0.22, ease: EASE }}
                className="h-full overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y px-2 py-1.5"
                style={{ overscrollBehavior: "contain" }}
              >
                {conversations.filter((c) => c.type === "group").length === 0 ? (
                  <EmptyState message="No groups yet" />
                ) : groupsItems.length === 0 ? (
                  <EmptyState message={query.trim() ? `No results for “${query.trim()}”` : "No groups yet"} />
                ) : (
                  <ChatsList
                    items={groupsItems}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    onMarkUnread={onMarkUnread}
                  />
                )}
              </motion.div>
            )}
            {activeTab === "spaces" && (
              <motion.div
                key="spaces"
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: -6 }}
                transition={reduce ? { duration: 0 } : { duration: 0.22, ease: EASE }}
                className="h-full overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y px-2 py-1.5"
                style={{ overscrollBehavior: "contain" }}
              >
                {filteredSpaces.length === 0 && query.trim() ? (
                  <EmptyState message={`No spaces match “${query.trim()}”`} />
                ) : (
                  <SpacesList
                    spaces={filteredSpaces}
                    channels={channels}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    onCreateSpace={onCreateSpace}
                  />
                )}
              </motion.div>
            )}
            {activeTab === "settings" && (
              <motion.div
                key="settings"
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: -6 }}
                transition={reduce ? { duration: 0 } : { duration: 0.22, ease: EASE }}
                className="h-full overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y"
                style={{ overscrollBehavior: "contain" }}
              >
                {/* Skip search for settings if filtered — but keep panel consistent */}
                <SettingsPanel />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <ProfileEditModal
        open={profileOpen}
        currentUser={currentUser}
        onClose={() => setProfileOpen(false)}
        onSaved={() => onProfileUpdate?.()}
      />
    </div>
  );
}

export default NestedSidebar;
