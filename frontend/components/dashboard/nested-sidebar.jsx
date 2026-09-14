"use client";

import {
  Bell,
  BellOff,
  Bookmark,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  Gamepad2,
  Hash,
  Info,
  Layers,
  LogOut,
  Mail,
  MapPin,
  Megaphone,
  Menu,
  MessageCircle,
  Palette,
  Pin,
  PinOff,
  Plus,
  Search,
  SearchCode,
  SearchX,
  Settings,
  ShieldBan,
  Smile,
  Trash2,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/dashboard/avatar";
import { ProfileEditModal } from "@/components/dashboard/profile-edit-modal";
import { AppearanceScreen } from "@/components/dashboard/appearance-screen";
import { SettingsPanel } from "@/components/dashboard/settings-panel";
import { FounderInviteCard, RichEmptyState } from "@/components/ui/empty-state";
import { StatusRing } from "@/components/status/status-ring";
import { EmojiFactoryPanel } from "@/components/emoji-factory-panel";
import { NearbyScreen } from "@/components/dashboard/nearby-screen";
import { clearSession, getToken } from "@/lib/auth";
import { markArenaEntry } from "@/lib/games";
import { isPlusUser } from "@/lib/plus";
import { playClick } from "@/lib/sound";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/motion/context-menu";

const EASE = [0.22, 1, 0.36, 1];
const EASE_STR = "cubic-bezier(0.22,1,0.36,1)";

function EmptyState({ message, icon: Icon = SearchX, actionLabel, onAction }) {
  return (
    <RichEmptyState
      compact
      icon={Icon}
      title={message}
      actionLabel={actionLabel}
      onAction={onAction}
    />
  );
}

function ConversationItem({ conversation, selected, onSelect, onMarkUnread, onRemove, onPin, onMute, onViewInfo, onBlock, index }) {
  const { name, lastMessage, time, unread, online, type, isPlus } = conversation;
  const isGroup = type === "group";
  const isPinned = Boolean(conversation.pinned);
  const isMuted = Boolean(conversation.muted);
  const isBlocked = Boolean(conversation.isBlockedByMe);
  const [isPressing, setIsPressing] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const holdTimer = useRef(null);
  const pressOrigin = useRef(null);
  const clearHold = () => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
  };
  useEffect(() => () => clearHold(), []);
  const handlePointerDown = (e) => {
    if (e.pointerType === "touch" || e.pointerType === "pen") {
      pressOrigin.current = { x: e.clientX, y: e.clientY };
      setIsPressing(true);
      setIsHolding(false);
      clearHold();
      holdTimer.current = setTimeout(() => {
        setIsHolding(true);
        setIsPressing(false);
      }, 380);
    }
  };
  const handlePointerMove = (e) => {
    if (!pressOrigin.current || (e.pointerType !== "touch" && e.pointerType !== "pen")) return;
    const dx = e.clientX - pressOrigin.current.x;
    const dy = e.clientY - pressOrigin.current.y;
    if (Math.hypot(dx, dy) > 12) {
      setIsPressing(false);
      setIsHolding(false);
      clearHold();
      pressOrigin.current = null;
    }
  };
  const handlePointerUp = () => {
    const wasHolding = isHolding;
    setIsPressing(false);
    clearHold();
    pressOrigin.current = null;
    if (wasHolding) {
      setTimeout(() => setIsHolding(false), 800);
    } else {
      setIsHolding(false);
    }
  };
  const handlePointerCancel = () => {
    setIsPressing(false);
    setIsHolding(false);
    clearHold();
    pressOrigin.current = null;
  };
  const pressBg = isHolding ? "bg-[var(--accent-soft)]" : isPressing ? "bg-[var(--hover)]" : "";
  const pressScale = isPressing ? "scale-[0.98]" : isHolding ? "scale-[0.992]" : "";
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <button
          type="button"
          onClick={onSelect}
          aria-current={selected ? "true" : undefined}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerLeave={handlePointerCancel}
          style={{ animationDelay: `${Math.min(index, 12) * 28}ms` }}
          className={`group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left select-none touch-manipulation [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent] will-change-transform transition-[transform,background-color] duration-150 ease-[${EASE_STR}] motion-reduce:animate-none animate-[t-item-in_0.4s_${EASE_STR}_both] hover:cursor-pointer active:bg-[var(--hover)] active:scale-[0.98] aria-expanded:bg-[var(--accent-soft)] aria-expanded:scale-[0.992] ${pressBg} ${pressScale} ${
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
              isPlus={Boolean(isPlus)}
              shape="circle"
            />
            {isPinned && (
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)] shadow-sm ring-2 ring-[var(--bg-elevated)]">
                <Pin className="h-2.5 w-2.5" strokeWidth={2.5} />
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-[var(--text-primary)]">{name}</span>
              <span className="flex shrink-0 items-center gap-1">
                {isPinned && <Pin className="h-3 w-3 text-[var(--text-muted)]" strokeWidth={2} />}
                {isMuted && <BellOff className="h-3 w-3 text-[var(--text-muted)]" strokeWidth={2} />}
                {time && <span className="text-[11px] text-[var(--text-muted)]">{time}</span>}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[13px] text-[var(--text-muted)]">
                {lastMessage || (isGroup ? "Group conversation" : "")}
              </span>
              {unread > 0 ? (
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[11px] font-semibold text-[var(--on-accent)]">
                  {unread}
                </span>
              ) : isMuted ? (
                <BellOff className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] opacity-60" />
              ) : null}
            </div>
          </div>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent ariaLabel="Conversation actions">
        <ContextMenuItem onSelect={() => onPin?.(conversation.id)}>
          {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          {isPinned ? "Unpin" : "Pin to top"}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onMute?.(conversation.id)}>
          {isMuted ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          {isMuted ? "Unmute" : "Mute"}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onMarkUnread?.(conversation.id)}>
          <Mail className="h-4 w-4" />
          Mark as unread
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onViewInfo?.(conversation)}>
          {isGroup ? <Info className="h-4 w-4" /> : <User className="h-4 w-4" />}
          {isGroup ? "Group info" : "View profile"}
        </ContextMenuItem>
        {conversation.type === "dm" && onBlock && (
          <ContextMenuItem tone={isBlocked ? "default" : "destructive"} onSelect={() => onBlock?.(conversation)}>
            <ShieldBan className="h-4 w-4" />
            {isBlocked ? "Unblock" : "Block"}
          </ContextMenuItem>
        )}
        {onRemove && (conversation.type === "dm" || conversation.type === "group") && (
          <ContextMenuItem tone="destructive" onSelect={() => onRemove?.(conversation)}>
            <Trash2 className="h-4 w-4" />
            Remove from list
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

function ChatRowList({ items, selectedId, onSelect, onMarkUnread, onRemove, onPin, onMute, onViewInfo, onBlock, baseIndex = 0 }) {
  return (
    <div className="w-full min-w-0 space-y-0.5">
      {items.map((c, i) => (
        <ConversationItem
          key={c.id}
          conversation={c}
          selected={c.id === selectedId}
          onSelect={() => onSelect(c.id)}
          onMarkUnread={onMarkUnread}
          onRemove={onRemove}
          onPin={onPin}
          onMute={onMute}
          onViewInfo={onViewInfo}
          onBlock={onBlock}
          index={baseIndex + i}
        />
      ))}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="flex w-full min-w-0 items-center px-3 pb-1 pt-3">
      <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {children}
      </span>
    </div>
  );
}

// Desktop chat list: pinned conversations get their own "Pinned" section on
// top, everything else sits under the given label ("Messages" / "Groups").
// Row design itself is unchanged — only the grouping is new.
function ChatsList({ items, selectedId, onSelect, onMarkUnread, onRemove, onPin, onMute, onViewInfo, onBlock, restLabel = "Messages" }) {
  if (!items.length) return <EmptyState message="No conversations yet" />;
  const pinned = items.filter((c) => c.pinned);
  const rest = items.filter((c) => !c.pinned);
  const rowProps = { selectedId, onSelect, onMarkUnread, onRemove, onPin, onMute, onViewInfo, onBlock };
  if (!pinned.length) {
    return (
      <div className="w-full min-w-0">
        <SectionLabel>{restLabel}</SectionLabel>
        <ChatRowList items={rest} {...rowProps} />
      </div>
    );
  }
  return (
    <div className="w-full min-w-0">
      <SectionLabel>Pinned</SectionLabel>
      <ChatRowList items={pinned} {...rowProps} />
      {rest.length > 0 && (
        <>
          <SectionLabel>{restLabel}</SectionLabel>
          <ChatRowList items={rest} {...rowProps} baseIndex={pinned.length} />
        </>
      )}
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
      <RichEmptyState
        compact
        icon={Layers}
        title="No spaces yet"
        hint="Create a community or discover public ones to join."
        actionLabel="Create a space"
        onAction={onCreateSpace}
      />
    );
  }

  return (
    <div className="w-full min-w-0 space-y-1">
      {spaces.map((space) => {
        const spaceChannels = channels.filter((c) => c.spaceId === space.id);
        const expandedOpen = isExpanded(space.id);
        return (
          <div key={space.id} className="w-full min-w-0 rounded-xl px-1">
            <button
              type="button"
              onClick={() => toggle(space.id)}
              className="flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:cursor-pointer hover:bg-[var(--hover)]"
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

// ── Desktop status strip ────────────────────────────────────────────────────
// Status lives inline at the top of the desktop sidebar (no separate tab):
// a horizontal row under the search header, starting with the user's own
// status / upload affordance, then one circle per friend with updates.
function DesktopStatusStrip({
  myStatuses = [],
  feed = [],
  currentUser,
  onCreate,
  onViewUser,
  onViewMy,
  uploading = false,
}) {
  const hasMy = Array.isArray(myStatuses) && myStatuses.length > 0;
  const myLabel = currentUser?.displayName || currentUser?.username || "You";
  return (
    <div className="w-full min-w-0 shrink-0 border-b border-[var(--border)] px-3 py-2.5">
      <div
        className="flex w-full min-w-0 items-start gap-3 overflow-x-auto overscroll-x-contain pb-0.5 no-scrollbar"
        style={{ overscrollBehaviorX: "contain" }}
      >
        {/* Own status first — view mine, or create when empty */}
        <button
          type="button"
          onClick={() => (hasMy ? onViewMy?.() : onCreate?.())}
          disabled={uploading}
          className="flex w-14 shrink-0 flex-col items-center gap-1 rounded-lg py-0.5 transition-colors duration-150 hover:cursor-pointer disabled:opacity-60"
        >
          <span className="relative">
            <StatusRing
              name={myLabel}
              url={currentUser?.avatarUrl}
              avatarStyle={currentUser?.avatarStyle}
              isPlus={false}
              hasUnseen={hasMy ? false : undefined}
              isMine={!hasMy}
              shape="circle"
            />
            {uploading && (
              <span
                aria-hidden="true"
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40"
              >
                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              </span>
            )}
          </span>
          <span className="w-full truncate text-center text-[11px] leading-tight text-[var(--text-muted)]">
            {uploading ? "Posting…" : "You"}
          </span>
        </button>

        {(Array.isArray(feed) ? feed : []).map((group) => {
          const user = group?.user || {};
          const key = user._id || user.id || group?.userId;
          const unseen = (group?.statuses || []).some((s) => !s.isViewed);
          const label = user.displayName || user.username || "Friend";
          return (
            <button
              key={key}
              type="button"
              onClick={() => onViewUser?.(group)}
              title={label}
              className="flex w-14 shrink-0 flex-col items-center gap-1 rounded-lg py-0.5 transition-colors duration-150 hover:cursor-pointer"
            >
              <StatusRing
                name={label}
                url={user.avatarUrl}
                avatarStyle={user.avatarStyle}
                isPlus={false}
                hasUnseen={unseen}
                shape="circle"
              />
              <span className="w-full truncate text-center text-[11px] leading-tight text-[var(--text-muted)]">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Desktop floating pill bar ───────────────────────────────────────────────
// Bottom-lifted tab access: four detached pills (never touching) with their
// own backgrounds. The active pill stretches to show its label; inactive
// pills are icon-only. "More" is a real tab like Message/Groups/Spaces — it
// swaps the sidebar body to the More list.
const DESKTOP_PILL_TABS = [
  { id: "chats", label: "Message", icon: MessageCircle },
  { id: "groups", label: "Groups", icon: Users },
  { id: "spaces", label: "Spaces", icon: Layers },
  { id: "more", label: "More", icon: Menu },
];

function DesktopPillBar({ pillActive, onTabChange, unread = {} }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4">
      <div className="pointer-events-auto relative flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)]/70 p-2 shadow-xl backdrop-blur-xl supports-[backdrop-filter]:bg-[var(--bg-elevated)]/60">
        {DESKTOP_PILL_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = pillActive === tab.id;
          const hasUnread = Boolean(unread?.[tab.id]);
          return (
            <button
              key={tab.id}
              type="button"
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
              title={tab.label}
              onClick={() => onTabChange?.(tab.id)}
              className={cn(
                "relative flex h-11 shrink-0 items-center justify-center gap-2 rounded-full shadow-sm transition-[width,background-color,color,transform] duration-200 hover:cursor-pointer active:scale-95",
                isActive
                  ? "w-auto bg-[var(--accent)] px-5 text-[13px] font-semibold text-[var(--on-accent)]"
                  : "size-11 border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={isActive ? 2.2 : 1.8} />
              {isActive && <span className="whitespace-nowrap">{tab.label}</span>}
              {hasUnread && !isActive && (
                <span
                  className="absolute right-2 top-2 size-2.5 rounded-full bg-[#ff3b30] ring-2 ring-[var(--bg-elevated)]"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Back row for sub-panels opened from the More list (Settings, Emoji Factory).
function SubPanelBack({ label = "More", onBack }) {
  return (
    <div className="w-full min-w-0 shrink-0 px-2 pb-1 pt-2">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-[13px] font-medium text-[var(--text-muted)] transition-colors duration-150 hover:cursor-pointer hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2} />
        {label}
      </button>
    </div>
  );
}

// ── Desktop More list ───────────────────────────────────────────────────────
// The "More" tab body: remaining destinations as full sidebar rows, same row
// geometry as the chat lists (rounded-xl, px-2.5 py-2.5, hover surface).
function MoreList({ items }) {
  if (!items.length) return <EmptyState message="Nothing here" />;
  return (
    <div className="w-full min-w-0">
      <SectionLabel>More</SectionLabel>
      <div className="w-full min-w-0 space-y-0.5">
        {items.map((item, i) => {
          const Icon = item.icon;
          const destructive = item.tone === "destructive";
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => item.action?.()}
              style={{ animationDelay: `${Math.min(i, 12) * 28}ms` }}
              className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors duration-150 hover:cursor-pointer hover:bg-[var(--hover)] motion-reduce:animate-none animate-[t-item-in_0.4s_cubic-bezier(0.22,1,0.36,1)_both]"
            >
              {item.avatar ? (
                <span className="shrink-0">{item.avatar}</span>
              ) : (
                <span
                  aria-hidden="true"
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--hover)] ring-1 ring-inset ring-[var(--border)] ${
                    destructive ? "text-[var(--destructive)]" : "text-[var(--text-primary)]"
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-sm font-medium ${
                    destructive ? "text-[var(--destructive)]" : "text-[var(--text-primary)]"
                  }`}
                >
                  {item.label}
                </span>
                {item.hint && (
                  <span className="block truncate text-[13px] text-[var(--text-muted)]">
                    {item.hint}
                  </span>
                )}
              </span>
              {item.active && (
                <span className="size-2 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden="true" />
              )}
              <ChevronRight
                className="h-4 w-4 shrink-0 text-[var(--text-muted)] opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                strokeWidth={1.8}
              />
            </button>
          );
        })}
      </div>
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
  onRemoveConversation,
  onPin,
  onMute,
  onViewInfo,
  onBlock,
  onCompose,
  onNewGroup,
  onCreateSpace,
  onDiscoverSpaces,
  unread = {},
  statusFeed = [],
  myStatuses = [],
  onStatusCreate,
  onStatusViewUser,
  onStatusViewMy,
  statusUploading = false,
}) {
  const reduce = useReducedMotion();
  const [activeTab, setActiveTab] = useState("chats");
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [nearbyOpen, setNearbyOpen] = useState(false);
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

  const selfConv = useMemo(
    () => filteredConversations.find((c) => c.type === "self" || c.isSelf) || null,
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
    chats: "Search messages",
    groups: "Search groups",
    spaces: "Search spaces",
    more: "Search more",
    settings: "Search",
    "emoji-factory": "Search emoji",
  };

  const router = useRouter();
  const profileLabel =
    currentUser?.displayName || currentUser?.username || currentUser?.email || "Profile";

  // Message / Groups / Spaces / More are all real tabs. Settings and the
  // emoji factory open from the More list and keep the "More" pill expanded.
  const pillActive =
    activeTab === "chats" ||
    activeTab === "groups" ||
    activeTab === "spaces" ||
    activeTab === "more"
      ? activeTab
      : "more";
  const showStatusStrip =
    activeTab === "chats" || activeTab === "groups" || activeTab === "spaces";

  async function handleSignOut() {
    const token = getToken();
    try {
      await fetch("/api/v1/auth/logout", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: "include",
      });
    } catch {}
    clearSession();
    router.replace("/login");
  }

  function handlePillTabChange(id) {
    if (id === "chats" || id === "groups" || id === "spaces" || id === "more") setActiveTab(id);
  }

  // Everything that isn't Message / Groups / Spaces lives behind "More".
  const moreItems = [
    ...(onSearchOpen
      ? [{ id: "search", label: "Search", hint: "Messages, people & spaces", icon: SearchCode, action: onSearchOpen }]
      : []),
    ...(onSavedOpen
      ? [{ id: "saved", label: "Saved messages", hint: "Your private space", icon: Bookmark, action: onSavedOpen }]
      : []),
    ...(onDiscoverSpaces
      ? [{ id: "discover", label: "Discover Spaces", hint: "Find and join public communities", icon: Compass, action: onDiscoverSpaces }]
      : []),
    { id: "nearby", label: "Nearby users", hint: "Discover people near you", icon: MapPin, action: () => setNearbyOpen(true) },
    {
      id: "games",
      label: "Kivo Games",
      hint: "Play a Typing Race with someone",
      icon: Gamepad2,
      action: () => {
        markArenaEntry();
        playClick();
        router.push("/games");
      },
    },
    { id: "emoji-factory", label: "Emoji Factory", hint: "Create personal emoji", icon: Smile, action: () => setActiveTab("emoji-factory"), active: activeTab === "emoji-factory" },
    { id: "settings", label: "Settings", hint: "Badge, privacy & notifications", icon: Settings, action: () => setActiveTab("settings"), active: activeTab === "settings" },
    { id: "appearance", label: "Appearance", hint: "Theme, colors & chat look", icon: Palette, action: () => setAppearanceOpen(true) },
    {
      id: "profile",
      label: profileLabel,
      hint: currentUser?.username ? `@${currentUser.username}` : "Your public profile",
      icon: User,
      avatar: (
        <Avatar
          name={profileLabel}
          avatarStyle={currentUser?.avatarStyle}
          url={currentUser?.avatarUrl}
          size="sm"
          shape="circle"
          isPlus={isPlusUser(currentUser)}
        />
      ),
      action: () => setProfileOpen(true),
    },
    { id: "signout", label: "Sign out", icon: LogOut, tone: "destructive", action: handleSignOut },
  ];

  // Inline search also filters the More list.
  const visibleMoreItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return moreItems;
    return moreItems.filter((i) =>
      `${i.label || ""} ${i.hint || ""}`.toLowerCase().includes(q),
    );
    // moreItems is rebuilt every render by design — filter on query + tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, activeTab, conversations, spaces, currentUser]);

  return (
    <div className="relative flex h-full w-full min-w-0 flex-col bg-[var(--bg-elevated)]">
      {/* Top search row: inline filter + status camera + New (plus) */}
      <div className="flex w-full min-w-0 shrink-0 flex-col gap-2 px-3 pt-3">
        <div className="flex w-full min-w-0 items-center gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-inputs)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus-within:border-[var(--accent)]">
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

          {/* Camera — jump straight into a status update */}
          <button
            type="button"
            onClick={onStatusCreate}
            aria-label="Add status"
            title="Add status"
            className="kivo-focus relative flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
          >
            <Camera className="h-[18px] w-[18px]" strokeWidth={1.8} />
            {Boolean(unread?.status) && (
              <span
                className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[#25D366] ring-2 ring-[var(--bg-elevated)]"
                aria-hidden="true"
              />
            )}
          </button>

          {notificationBell && <span className="shrink-0">{notificationBell}</span>}

          {/* Plus — Friends / Group / Space / Discover, same menu as before */}
          {onCompose && (
            <NewMenu
              onFriends={onCompose}
              onGroup={onNewGroup}
              onSpace={onCreateSpace}
              onDiscover={onDiscoverSpaces}
            />
          )}
        </div>

        {isOffline && (
          <div className="flex items-center gap-2 rounded-lg border border-[var(--destructive)]/20 bg-[var(--destructive)]/8 px-3 py-2">
            <span className="size-2 shrink-0 animate-pulse rounded-full bg-[var(--destructive)]" />
            <span className="text-[12px] font-medium text-[var(--destructive)]">You are offline</span>
          </div>
        )}
      </div>

      {/* Status — horizontal row directly under the search header */}
      {showStatusStrip && (
        <div className="pt-1.5">
          <DesktopStatusStrip
            myStatuses={myStatuses}
            feed={statusFeed}
            currentUser={currentUser}
            onCreate={onStatusCreate}
            onViewUser={onStatusViewUser}
            onViewMy={onStatusViewMy}
            uploading={statusUploading}
          />
        </div>
      )}

        {/* Panel body — exactly one context at a time, with shared easing.
            Bottom padding clears the lifted pill bar floating above. */}
        <div className="relative min-h-0 w-full min-w-0 flex-1 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {activeTab === "chats" && (
              <motion.div
                key="chats"
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: -6 }}
                transition={reduce ? { duration: 0 } : { duration: 0.22, ease: EASE }}
                className="h-full w-full min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y px-2 pb-24 pt-1.5 no-scrollbar"
                style={{ overscrollBehavior: "contain" }}
              >
                {selfConv && (
                  <button
                    type="button"
                    onClick={() => onSelect(selfConv.id)}
                    aria-current={selectedId === selfConv.id ? "true" : undefined}
                    className={`group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left select-none touch-manipulation transition-colors duration-150 hover:cursor-pointer ${
                      selectedId === selfConv.id ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--hover)]"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)]"
                    >
                      <Bookmark className="h-5 w-5" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-[var(--text-primary)]">
                          Saved Messages
                        </span>
                        {selfConv.time && (
                          <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
                            {selfConv.time}
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-[13px] text-[var(--text-muted)]">
                        {selfConv.lastMessage || "Your private space"}
                      </span>
                    </span>
                  </button>
                )}
                {conversations.filter((c) => c.type === "dm").length === 0 ? (
                  <>
                    <RichEmptyState
                      icon={MessageCircle}
                      title="No chats yet"
                      hint="Add a friend to start your first chat."
                      actionLabel="Find friends"
                      onAction={onCompose}
                    />
                    <FounderInviteCard />
                  </>
                ) : filteredConversations.length === 0 || chatsItems.length === 0 ? (
                  <EmptyState message={query.trim() ? `No results for “${query.trim()}”` : "No chats yet"} />
                ) : (
                  <ChatsList
                    items={chatsItems}
                    restLabel="Messages"
                    selectedId={selectedId}
                    onSelect={onSelect}
                    onMarkUnread={onMarkUnread}
                    onRemove={onRemoveConversation}
                    onPin={onPin}
                    onMute={onMute}
                    onViewInfo={onViewInfo}
                    onBlock={onBlock}
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
                className="h-full w-full min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y px-2 pb-24 pt-1.5 no-scrollbar"
                style={{ overscrollBehavior: "contain" }}
              >
                {conversations.filter((c) => c.type === "group").length === 0 ? (
                  <RichEmptyState
                    icon={Users}
                    title="No groups yet"
                    hint="Create a group with at least two friends."
                    actionLabel="New group"
                    onAction={onNewGroup}
                  />
                ) : groupsItems.length === 0 ? (
                  <EmptyState message={query.trim() ? `No results for “${query.trim()}”` : "No groups yet"} />
                ) : (
                  <ChatsList
                    items={groupsItems}
                    restLabel="Groups"
                    selectedId={selectedId}
                    onSelect={onSelect}
                    onMarkUnread={onMarkUnread}
                    onRemove={onRemoveConversation}
                    onPin={onPin}
                    onMute={onMute}
                    onViewInfo={onViewInfo}
                    onBlock={onBlock}
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
                className="h-full w-full min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y px-2 pb-24 pt-1.5 no-scrollbar"
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
            {activeTab === "more" && (
              <motion.div
                key="more"
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: -6 }}
                transition={reduce ? { duration: 0 } : { duration: 0.22, ease: EASE }}
                className="h-full w-full min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y px-2 pb-24 pt-1.5 no-scrollbar"
                style={{ overscrollBehavior: "contain" }}
              >
                {visibleMoreItems.length === 0 && query.trim() ? (
                  <EmptyState message={`No results for “${query.trim()}”`} />
                ) : (
                  <MoreList items={visibleMoreItems} />
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
                className="h-full w-full min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y pb-24 no-scrollbar"
                style={{ overscrollBehavior: "contain" }}
              >
                <SubPanelBack label="More" onBack={() => setActiveTab("more")} />
                <SettingsPanel />
              </motion.div>
            )}
            {activeTab === "emoji-factory" && (
              <motion.div
                key="emoji-factory"
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: -6 }}
                transition={reduce ? { duration: 0 } : { duration: 0.22, ease: EASE }}
                className="flex h-full w-full min-w-0 flex-col overflow-hidden"
                style={{ overscrollBehavior: "contain" }}
              >
                <SubPanelBack label="More" onBack={() => setActiveTab("more")} />
                <div className="min-h-0 w-full min-w-0 flex-1 overflow-hidden">
                  <EmojiFactoryPanel />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Lifted pill tab bar — Message / Groups / Spaces / More */}
          <DesktopPillBar
            pillActive={pillActive}
            onTabChange={handlePillTabChange}
            unread={unread}
          />
        </div>

      <ProfileEditModal
        open={profileOpen}
        currentUser={currentUser}
        onClose={() => setProfileOpen(false)}
        onSaved={() => onProfileUpdate?.()}
      />

      {appearanceOpen && (
        <AppearanceScreen onClose={() => setAppearanceOpen(false)} />
      )}
      {nearbyOpen && (
        <NearbyScreen onClose={() => setNearbyOpen(false)} />
      )}
    </div>
  );
}

export default NestedSidebar;
