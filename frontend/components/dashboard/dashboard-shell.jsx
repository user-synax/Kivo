"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "@/components/socket-provider";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { clearSession, getSession, getToken, setSession } from "@/lib/auth";
import {
  formatTime,
  otherParticipant,
  participantId,
  participantName,
} from "@/lib/chat";
import { ChatPanel } from "./chat-panel";
import { FriendsModal } from "./friends-modal";
import { GroupCreateModal } from "./group-create-modal";
import { GroupSettingsPanel } from "./group-settings-panel";
import { Sidebar } from "./sidebar";
import { NestedSidebar } from "./nested-sidebar";
import { SpaceCreateModal } from "@/components/spaces/space-create-modal";
import { SpaceSettingsPanel } from "@/components/spaces/space-settings-panel";
import { SpaceDiscoverModal } from "@/components/spaces/space-discover-modal";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { requestPermission, subscribe, syncSubscription } from "@/lib/push";
import { playCue } from "@/lib/sound";
import {
  getCachedConversations,
  getCachedSpaces,
  setCachedConversations,
  setCachedSpaces,
} from "@/lib/cache";
import { useIsDesktop } from "@/lib/use-breakpoint";
import { useOfflineStatus } from "@/lib/hooks/use-offline-status";
import { SearchOverlay } from "@/components/dashboard/search-overlay";
import { ProfileDrawer } from "@/components/profile/profile-drawer";
import { UserPanel } from "./user-panel";
import { BottomTabBar } from "./bottom-tab-bar";
import { Avatar } from "./avatar";
import { ProfileEditModal } from "./profile-edit-modal";
import { SettingsPanel } from "./settings-panel";
import { useTheme } from "@/components/theme-provider";

// Restrained easing — matches the rest of the app (no bounce).
const EASE = [0.22, 1, 0.36, 1];
const COLLAPSE_KEY = "kivo:sidebar-collapsed";
const SELECTED_KEY = "kivo:selected-conversation";

// Group settings surface: a slide-in drawer on smaller screens (with a dimmed
// backdrop) and a persistent side column on wide desktops (md+). The inner
// GroupSettingsPanel owns the content; this wrapper only controls positioning
// and the enter/exit transition so it works in both the mobile and desktop
// layouts.
function GroupSettingsOverlay({ open, conversation, onClose, onConversationUpdate, onLeft }) {
  const reduce = useReducedMotion();
  const slide = reduce ? { duration: 0 } : { duration: 0.28, ease: EASE };
  return (
    <AnimatePresence>
      {open && conversation && (
        <motion.div
          key="gs-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      )}
      {open && conversation && (
        <motion.aside
          key="gs-drawer"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={slide}
          className="fixed right-0 top-0 z-40 h-[100dvh] w-[320px] max-w-[88vw] border-l border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl md:static md:z-auto md:h-full md:max-w-none md:shadow-none"
        >
          <GroupSettingsPanel
            conversation={conversation}
            onClose={onClose}
            onConversationUpdate={onConversationUpdate}
            onLeft={onLeft}
          />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
function SpaceSettingsOverlay({ open, space, onClose, onUpdated, onDeleted, onLeft }) {
  const reduce = useReducedMotion();
  const slide = reduce ? { duration: 0 } : { duration: 0.28, ease: EASE };
  return (
    <AnimatePresence>
      {open && space && (
        <motion.div
          key="ss-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      )}
      {open && space && (
        <motion.aside
          key="ss-drawer"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={slide}
          className="fixed right-0 top-0 z-40 h-[100dvh] w-[360px] max-w-[88vw] border-l border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl md:static md:z-auto md:h-full md:max-w-none md:shadow-none"
        >
          <SpaceSettingsPanel space={space} onClose={onClose} onUpdated={onUpdated} onDeleted={onDeleted} onLeft={onLeft} />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function MobileSpacesTab({ spaces, channels, onSelect, onCreateSpace, onDiscover }) {
  const hasSpaces = Array.isArray(spaces) && spaces.length > 0;
  return (
    <div className="flex h-full flex-col bg-[var(--bg-elevated)] pt-[max(env(safe-area-inset-top),1rem)]">
      <div className="flex shrink-0 items-center justify-between px-5 py-3.5">
        <span className="truncate font-display text-3xl font-semibold tracking-tight text-[var(--text-primary)]">Spaces</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDiscover}
            className="rounded-full border border-[var(--border)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
          >
            Discover
          </button>
          <button
            type="button"
            onClick={onCreateSpace}
            className="rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--on-accent)] hover:opacity-90"
          >
            New
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y px-3 pb-[calc(64px+env(safe-area-inset-bottom))] pt-1.5" style={{ overscrollBehavior: "contain" }}>
        {!hasSpaces ? (
          <div className="px-3 py-10 text-center">
            <p className="text-[13px] text-[var(--text-muted)]">No spaces yet</p>
            <button type="button" onClick={onCreateSpace} className="mt-2 text-[12px] font-medium text-[#a3e635] hover:underline">
              Create a space
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {spaces.map((space) => {
              const spaceChannels = channels.filter((c) => c.spaceId === space.id);
              return (
                <div key={space.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={space.name} url={space.avatarUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{space.name}</p>
                      <p className="truncate text-[11px] text-[var(--text-muted)]">{space.category} • {spaceChannels.length} channel{spaceChannels.length !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  {spaceChannels.length > 0 && (
                    <div className="mt-2 space-y-0.5 border-t border-[var(--border)] pt-2">
                      {spaceChannels.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => onSelect(c.id)}
                          className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
                        >
                          <span className="truncate text-[12px]">#{c.name?.split("/").pop()?.replace(/^#/, "") || c.name}</span>
                          {c.unread > 0 && (
                            <span className="ml-auto flex size-4 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-semibold text-[var(--on-accent)]">
                              {c.unread > 9 ? "9+" : c.unread}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function MobileSettingsTab() {
  return (
    <div className="flex h-full flex-col bg-[var(--bg-elevated)] pt-[max(env(safe-area-inset-top),1rem)]">
      <div className="shrink-0 border-b border-[var(--border)] px-5 py-3.5">
        <span className="font-display text-3xl font-semibold tracking-tight text-[var(--text-primary)]">Settings</span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden pb-[calc(64px+env(safe-area-inset-bottom))] pt-1.5" style={{ overscrollBehavior: "contain" }}>
        <SettingsPanel />
      </div>
    </div>
  );
}

function MobileProfileTab({ currentUser, onProfileUpdate }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [user, setUser] = useState(currentUser);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setUser(currentUser);
  }, [currentUser]);

  useEffect(() => {
    let active = true;
    apiGet("/api/v1/users/me")
      .then((me) => {
        if (!active) return;
        setUser(me);
        setSession(me, getToken());
        onProfileUpdate?.();
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const handleSaved = () => {
    onProfileUpdate?.();
    setRefreshing(true);
    apiGet("/api/v1/users/me")
      .then((me) => {
        setUser(me);
        setSession(me, getToken());
      })
      .catch(() => {})
      .finally(() => setRefreshing(false));
  };

  async function handleLogout() {
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

  if (!user) return null;

  const rows = [
    { label: "Display name", value: user.displayName || "—" },
    { label: "Username", value: user.username || "—" },
    { label: "Email", value: user.email },
    { label: "Status", value: user.status || "—" },
    { label: "Role", value: user.role },
  ];

  return (
    <div className="flex h-full flex-col bg-[var(--bg-elevated)] pt-[max(env(safe-area-inset-top),1rem)]">
      <div className="shrink-0 border-b border-[var(--border)] px-5 py-3.5">
        <span className="font-display text-3xl font-semibold tracking-tight text-[var(--text-primary)]">Profile</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y px-5 pb-[calc(64px+env(safe-area-inset-bottom))] pt-6" style={{ overscrollBehavior: "contain" }}>
        {user.banner ? (
          <div className="h-28 w-full overflow-hidden rounded-xl border border-[var(--border)]">
            <img src={user.banner} alt="" aria-hidden="true" className="h-full w-full object-cover" />
          </div>
        ) : null}

        <div className="mt-6 flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6">
          <Avatar name={user.displayName || user.email || "?"} avatarStyle={user.avatarStyle} url={user.avatarUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-medium text-[var(--text-primary)]">{user.displayName || "—"}</p>
            <p className="truncate text-[13px] text-[var(--text-muted)]">{user.status || user.email}</p>
            {user.username && <p className="truncate text-[12px] text-[var(--text-muted)]">@{user.username}</p>}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5 text-[13px] font-medium text-[var(--text-primary)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--hover)]"
        >
          Edit profile
        </button>

        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6">
          {user.bio ? <p className="mb-4 text-sm text-[var(--text-primary)]">{user.bio}</p> : null}
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4 border-b border-[var(--border)] py-3 last:border-b-0">
              <span className="text-[13px] text-[var(--text-muted)]">{row.label}</span>
              <span className="truncate text-sm font-medium text-[var(--text-primary)]">{row.value}</span>
            </div>
          ))}
          {refreshing && <p className="pt-3 text-[11px] text-[var(--text-muted)]">Refreshing…</p>}
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--hover)]"
        >
          Log out
        </button>
      </div>
      <ProfileEditModal open={editOpen} currentUser={user} onClose={() => setEditOpen(false)} onSaved={handleSaved} />
    </div>
  );
}

// Convert a backend conversation into the shape the Sidebar renders.
function toListItem(c, currentUser, spaces) {
  const isGroup = c.type === "group";
  const isChannel = c.type === "space_channel";
  const other = otherParticipant(c, currentUser?.id);
  const online = Array.isArray(c.online) ? c.online.some(Boolean) : false;
  let name = isGroup ? c.name || "Group" : participantName(other);
  let avatarUrl = isGroup ? c.avatarUrl || null : other?.avatarUrl || null;
  if (isChannel) {
    const space = spaces?.find((s) => s.id === c.spaceId);
    name = space ? `${space.name} / #${c.name}` : `#${c.name}`;
    avatarUrl = space?.avatarUrl || null;
  }
  return {
    id: c.id,
    name,
    type: c.type,
    spaceId: c.spaceId || null,
    channelId: c.channelId || null,
    lastMessage: c.lastMessagePreview || (isGroup ? "Group conversation" : isChannel ? "Channel" : ""),
    time: formatTime(c.lastMessageAt),
    unread: c.unreadCount || 0,
    online,
    avatarStyle: isGroup || isChannel ? null : other?.avatarStyle || null,
    avatarUrl,
  };
}

export function DashboardShell() {
  const isDesktop = useIsDesktop();
  const reduce = useReducedMotion();
  const [selectedId, setSelectedId] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem(SELECTED_KEY) : null,
  );
  // Mirror selectedId into a ref so the socket handler (which only re-subscribes
  // on [socket]) can read the currently open conversation without stale closures.
  const selectedIdRef = useRef(selectedId);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);
  // Mirror the conversation list + an in-flight fetch guard so the socket handler
  // can detect a brand-new conversation and avoid duplicate list refreshes.
  const fetchingRef = useRef(new Set());
  const [collapsed, setCollapsed] = useState(false);
  const [conversations, setConversations] = useState([]);
  const conversationsRef = useRef(conversations);
  // Profile of the "other" participant in the open DM — powers the right-hand
  // detail panel. Fetched on conversation switch, keyed by the other user id.
  const [otherProfile, setOtherProfile] = useState(null);
  const [otherLoading, setOtherLoading] = useState(false);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);
  const [showFriends, setShowFriends] = useState(false);
  const [showGroupCreate, setShowGroupCreate] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [spaces, setSpaces] = useState([]);
  const [showSpaceCreate, setShowSpaceCreate] = useState(false);
  const [showSpaceSettings, setShowSpaceSettings] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState(null);
  const [showDiscover, setShowDiscover] = useState(false);
  const [pendingInvite, setPendingInvite] = useState(null);
  const [mobileTab, setMobileTab] = useState("chats");
  // Notifications — bell badge + center list, live via notification:new
  const [notifOpen, setNotifOpen] = useState(false);
  const notifOpenRef = useRef(false);
  notifOpenRef.current = notifOpen;
  const [notifications, setNotifications] = useState([]);
  const [notifNextCursor, setNotifNextCursor] = useState(null);
  const [notifHasMore, setNotifHasMore] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifUnread, setNotifUnread] = useState(0);
  const notificationsRef = useRef(notifications);
  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);
  const lastFocusedRef = useRef(null);
  const chatSwipeStartRef = useRef({ x: 0, y: 0 });
  const chatSwipeIsHorizontalRef = useRef(false);
  const chatSwipeIgnoreRef = useRef(false);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [panelDragDisabled, setPanelDragDisabled] = useState(false);
  const [lastActiveByUser, setLastActiveByUser] = useState({});
  const { socket, isConnected, reconnectNonce } = useSocket();
  const isOffline = useOfflineStatus(isConnected);
  // Search overlay state
  const [searchOpen, setSearchOpen] = useState(false);
  // Message highlight state: when a search result is clicked, we store the
  // target message id and conversation id so ChatPanel can scroll + highlight it.
  const [highlightMessageId, setHighlightMessageId] = useState(null);
  // currentUser is state (not a bare getSession() read) so the sidebar avatar
  // re-renders after the user saves a new avatar style in the edit modal.
  const [currentUser, setCurrentUser] = useState(() => getSession());
  const refreshUser = useCallback(() => setCurrentUser(getSession()), []);

  // The localStorage session may be stale (e.g. created before avatarUrl was
  // added to the auth response, or before the first avatar upload). Re-fetch the
  // authoritative current-user profile so the sidebar/avatar always reflect the
  // latest avatarUrl. Persist it back so other routes (profile page) see it too.
  useEffect(() => {
    let active = true;
    apiGet("/api/v1/users/me")
      .then((me) => {
        if (!active) return;
        setCurrentUser((prev) => ({ ...(prev || {}), ...me }));
        setSession(me, getToken());
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // The "other" participant id of the currently open DM, derived from the
  // conversation list so it's available to the profile-fetch effect (which runs
  // before `selected` is computed later in render). Groups have no single
  // "other", so we resolve null for them.
  const selectedOtherId = (() => {
    if (!selectedId) return null;
    const conv = conversations.find((c) => c.id === selectedId);
    if (!conv || conv.type !== "dm") return null;
    return participantId(otherParticipant(conv, currentUser?.id));
  })();
  const router = useRouter();
  const slide = reduce ? { duration: 0 } : { duration: 0.28, ease: EASE };

  // The session can lapse mid-use (e.g. an expired token whose refresh also
  // fails). Rather than crash the dashboard, bounce to login.
  useEffect(() => {
    if (!currentUser) router.replace("/login");
  }, [currentUser, router]);

  // Sync existing push subscription if permission already granted (no prompt).
  useEffect(() => {
    if (!currentUser) return;
    syncSubscription().catch(() => {});
  }, [currentUser]);


  // Service-worker push click → navigate to conversation while app is open in another tab.
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    function onSWMessage(event) {
      const data = event.data;
      if (data?.type === "kivo:notification-click" && data.conversationId) {
        setSelectedId(data.conversationId);
        setShowGroupSettings(false);
        setShowSpaceSettings(false);
      }
    }
    // Both navigator.serviceWorker and window can receive the postMessage; listen on both.
    navigator.serviceWorker.addEventListener("message", onSWMessage);
    window.addEventListener("message", (e) => {
      if (e.data?.type === "kivo:notification-click") onSWMessage(e);
    });
    return () => navigator.serviceWorker.removeEventListener("message", onSWMessage);
  }, []);

  // Initial notifications fetch: unread count + first page.
  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    apiGet("/api/v1/notifications/unread-count")
      .then((d) => {
        if (!active) return;
        setNotifUnread(typeof d?.count === "number" ? d.count : 0);
      })
      .catch(() => {});
    setNotifLoading(true);
    apiGet("/api/v1/notifications?limit=20")
      .then((d) => {
        if (!active) return;
        setNotifications(Array.isArray(d?.notifications) ? d.notifications : []);
        setNotifNextCursor(d?.nextCursor || null);
        setNotifHasMore(Boolean(d?.nextCursor));
      })
      .catch(() => {})
      .finally(() => {
        if (active) setNotifLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentUser]);

  // Track focused DM for backend suppression (and local echo suppression).
  // Emits which conversation the user is actively viewing so the server can
  // skip creating a dm_message notification when they're already in that DM.
  // Uses lastFocusedRef to avoid duplicate emits when conversations list churns.
  useEffect(() => {
    if (!socket) return;
    const conv =
      conversationsRef.current.find((c) => c.id === selectedId) ||
      conversations.find((c) => c.id === selectedId);
    const focusedId = selectedId && conv?.type === "dm" ? selectedId : null;
    if (focusedId !== lastFocusedRef.current) {
      lastFocusedRef.current = focusedId;
      if (focusedId) socket.emit("conversation:focus", { conversationId: focusedId });
      else socket.emit("conversation:blur");
    }
    return () => {
      // don't blur here — other effect invocation will handle transition
    };
  }, [socket, selectedId, conversations]);

  // Live bell/center updates — prepend without refetch.
  // DM-focused filter: if the user is currently viewing that DM, don't show it
  // (backend also suppresses, this is a fallback for race/edge cases).
  useEffect(() => {
    if (!socket) return;
    const onNotificationNew = (notif) => {
      if (!notif?.id) return;
      // Friend requests/accepts have no message event — cue from here. Stay
      // quiet while the notification center is open and the tab is visible.
      if (notif.type === "friend_request" || notif.type === "friend_accept") {
        const pageHidden =
          typeof document !== "undefined" && document.visibilityState !== "visible";
        if (pageHidden || !notifOpenRef.current) playCue("friendRequests");
      }
      if (notif.type === "dm_message" && notif.conversationId === selectedIdRef.current) {
        const cur = conversationsRef.current.find((c) => c.id === selectedIdRef.current);
        if (cur?.type === "dm") return;
      }
      setNotifications((prev) => {
        if (prev.some((n) => n.id === notif.id)) return prev;
        return [notif, ...prev];
      });
      setNotifUnread((c) => c + 1);
    };
    socket.on("notification:new", onNotificationNew);
    return () => socket.off("notification:new", onNotificationNew);
  }, [socket]);

  // Persist collapse state (desktop only) across reloads.
  useEffect(() => {
    const saved = localStorage.getItem(COLLAPSE_KEY);
    if (saved !== null) setCollapsed(saved === "1");
  }, []);
  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  // Remember the open conversation across reloads so the chat doesn't reset to the
  // empty state on every refresh.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedId) localStorage.setItem(SELECTED_KEY, selectedId);
    else localStorage.removeItem(SELECTED_KEY);
  }, [selectedId]);

  // Ctrl+K / Cmd+K global keyboard shortcut for search
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Mobile: trap browser back / edge swipe so it returns to list (DM/Group/Space), not to /login.
  useEffect(() => {
    if (isDesktop || !selectedId) return;
    const url = window.location.href;
    try {
      window.history.pushState({ kivoChat: selectedId }, "", url);
    } catch {}
    const onPopState = () => {
      setSelectedId((curr) => (curr ? null : curr));
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      // clean up the pushed entry if user went back via our drag (setSelectedId null) without pop
      try {
        if (window.history.state?.kivoChat) window.history.back();
      } catch {}
    };
  }, [isDesktop, selectedId]);

  // Reusable list loader (also used to pull in a conversation that just appeared).
  const loadConversations = useCallback(() => {
    return apiGet("/api/v1/conversations")
      .then((data) => (Array.isArray(data) ? data : []))
      .catch(() => []);
  }, []);

  const loadSpaces = useCallback(() => {
    return apiGet("/api/v1/spaces")
      .then((data) => (Array.isArray(data) ? data : []))
      .catch(() => []);
  }, []);
  const upsertSpace = useCallback((space) => {
    if (!space?.id) return;
    setSpaces((prev) => {
      const idx = prev.findIndex((s) => s.id === space.id);
      const next =
        idx === -1
          ? [space, ...prev]
          : (() => {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...space };
              return copy;
            })();
      const uid = getSession()?.id;
      if (uid) setCachedSpaces(uid, next).catch(() => {});
      return next;
    });
  }, []);

  // Invite deep link (/app?join=CODE). Joins the Space the code points at and
  // drops the query param so a reload can't re-trigger the join. On failure the
  // Discover modal opens with the code prefilled so the user can retry/paste.
  const joinByCodeHandledRef = useRef(false);
  useEffect(() => {
    if (!currentUser || joinByCodeHandledRef.current) return;
    const params =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : null;
    const code = params?.get("join")?.trim();
    if (!code) return;
    joinByCodeHandledRef.current = true;
    const cleanupUrl = () => {
      try {
        window.history.replaceState(null, "", window.location.pathname);
      } catch {}
    };
    apiPost(`/api/v1/spaces/join/${encodeURIComponent(code)}`)
      .then((space) => {
        cleanupUrl();
        upsertSpace(space);
        const uid = getSession()?.id;
        loadSpaces().then((list) => {
          setSpaces(list);
          if (uid) setCachedSpaces(uid, list).catch(() => {});
        });
        loadConversations().then((list) => {
          setConversations(list);
          if (uid) setCachedConversations(uid, list).catch(() => {});
          const conv = list.find(
            (c) => c.type === "space_channel" && c.spaceId === space.id
          );
          if (conv) setSelectedId(conv.id);
        });
      })
      .catch((err) => {
        cleanupUrl();
        setPendingInvite({
          code,
          message:
            err?.message || "Couldn't join this Space with the invite link.",
        });
        setShowDiscover(true);
      });
  }, [currentUser, loadConversations, loadSpaces, upsertSpace]);

  // Insert or merge a conversation into the list (drives sidebar + selected).
  // Recomputes isAdmin from the admins array so realtime events — which carry the
  // acting member's perspective — don't clobber the current user's admin flag.
  const upsertConversation = useCallback((conv) => {
    if (!conv?.id) return;
    const me = getSession();
    const merged = {
      ...conv,
      isAdmin: (conv.admins || []).map(String).includes(me?.id),
    };
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === conv.id);
      const next =
        idx === -1
          ? [merged, ...prev]
          : (() => {
              const copy = [...prev];
              copy[idx] = {
                ...copy[idx],
                ...merged,
                unreadCount: merged.unreadCount ?? copy[idx].unreadCount,
              };
              return copy;
            })();
      const uid = me?.id;
      if (uid) setCachedConversations(uid, next).catch(() => {});
      return next;
    });
  }, []);

  // Load spaces once on mount — stale-while-revalidate via IndexedDB.
  useEffect(() => {
    let active = true;
    const uid = getSession()?.id;
    if (uid) {
      getCachedSpaces(uid)
        .then((cached) => {
          if (!active) return;
          if (Array.isArray(cached) && cached.length) setSpaces(cached);
        })
        .catch(() => {});
    }
    loadSpaces()
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : [];
        setSpaces(list);
        if (uid) setCachedSpaces(uid, list).catch(() => {});
      })
      .catch(() => {
        if (active) setSpaces([]);
      });
    return () => {
      active = false;
    };
  }, [loadSpaces]);

  // Load the conversation list once on mount — stale-while-revalidate via IndexedDB.
  useEffect(() => {
    let active = true;
    const uid = getSession()?.id;
    if (uid) {
      getCachedConversations(uid)
        .then((cached) => {
          if (!active) return;
          if (Array.isArray(cached) && cached.length) {
            setConversations(cached);
            const sel =
              typeof window !== "undefined"
                ? localStorage.getItem(SELECTED_KEY)
                : null;
            if (sel && !cached.some((c) => c.id === sel)) {
              localStorage.removeItem(SELECTED_KEY);
              setSelectedId(null);
            }
          }
        })
        .catch(() => {});
    }
    loadConversations()
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : [];
        setConversations(list);
        if (uid) setCachedConversations(uid, list).catch(() => {});
        // The open conversation may have been restored from localStorage before
        // this fetch resolved — clear its unread now so the badge doesn't stick.
        const restored = selectedIdRef.current;
        if (restored && list.some((c) => c.id === restored)) {
          apiPatch(`/api/v1/conversations/${restored}/read`, {}).catch(
            () => {},
          );
          setConversations((prev) => {
            const next = prev.map((c) =>
              c.id === restored ? { ...c, unreadCount: 0 } : c,
            );
            if (uid) setCachedConversations(uid, next).catch(() => {});
            return next;
          });
        }
      })
      .catch(() => {
        if (active) setConversations([]);
      });
    return () => {
      active = false;
    };
  }, [loadConversations]);

  // Reconnect catch-up: refresh conversation list so unread counts,
  // lastMessageAt and previews correct themselves for conversations that
  // received messages while disconnected. Runs once per successful reconnect,
  // not on every backoff retry. Fails silently — next reconnect will retry.
  useEffect(() => {
    if (reconnectNonce === 0) return;
    loadConversations()
      .then((list) => {
        setConversations(list);
        const uid = getSession()?.id;
        if (uid) setCachedConversations(uid, list).catch(() => {});
      })
      .catch(() => {});
  }, [reconnectNonce, loadConversations]);

  // Load the "other" participant's full profile whenever the open DM changes,
  // so the right-hand detail panel stays in sync. Group conversations have no
  // single "other", so we skip them.
  useEffect(() => {
    if (!selectedOtherId) {
      setOtherProfile(null);
      setOtherLoading(false);
      return undefined;
    }
    let active = true;
    setOtherLoading(true);
    apiGet(`/api/v1/users/${selectedOtherId}`)
      .then((data) => {
        if (active) setOtherProfile(data || null);
      })
      .catch(() => {
        if (active) setOtherProfile(null);
      })
      .finally(() => {
        if (active) setOtherLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedOtherId]);

  // Mark the opened conversation as read (clears its unread badge). Also runs on
  // mount (selectedId restored from localStorage) and on every selection change.
  useEffect(() => {
    if (!selectedId) return undefined;
    apiPatch(`/api/v1/conversations/${selectedId}/read`, {}).catch(() => {});
    setConversations((prev) => {
      const next = prev.map((c) => (c.id === selectedId ? { ...c, unreadCount: 0 } : c));
      const uid = getSession()?.id;
      if (uid) setCachedConversations(uid, next).catch(() => {});
      return next;
    });
    return undefined;
  }, [selectedId]);

  // Global realtime updates for the conversation list.
  useEffect(() => {
    if (!socket) return undefined;

    const onNew = (msg) => {
      if (!msg?.conversationId) return;
      // Sound cue by category — only when the event deserves attention:
      // DM: tab hidden OR that conversation isn't focused (classic behavior).
      // Mention: tab hidden OR conversation not focused, in any conversation
      // (mention cues override the group/space category like the server prefs).
      // Group / Space message: only when the tab is hidden AND the conversation
      // isn't focused — reading another chat in-app stays quiet. System messages
      // (e.g. "you are now friends") never chime.
      try {
        if (msg.senderId !== currentUser?.id && msg.type !== "system") {
          const conv = conversationsRef.current.find((c) => c.id === msg.conversationId);
          const convType = conv ? conv.type : "dm"; // brand-new conv assumed dm
          const isVisible = typeof document !== "undefined" ? document.visibilityState === "visible" : true;
          const isFocused = msg.conversationId === selectedIdRef.current;
          const mentioned = (msg.mentions || []).includes(currentUser?.id);
          if (convType === "dm") {
            if (!isVisible || !isFocused) playCue("directMessages");
          } else if (mentioned) {
            if (!isVisible || !isFocused) playCue("mentions");
          } else if (!isVisible && !isFocused) {
            if (convType === "group") playCue("groupMessages");
            else if (convType === "space_channel") playCue("spaceMessages");
          }
        }
      } catch {}
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === msg.conversationId);
        if (idx === -1) return prev;
        const isMine = msg.senderId === currentUser?.id;
        // If the conversation is currently open the viewer is looking at it, so
        // don't bump the unread badge (chat-panel already marks it read on
        // receipt). Only unread conversations get incremented.
        const isOpen = msg.conversationId === selectedIdRef.current;
        const updated = {
          ...prev[idx],
          lastMessageAt: msg.createdAt,
          lastMessagePreview: msg.isDeleted ? "" : msg.content,
          unreadCount: isMine
            ? prev[idx].unreadCount
            : isOpen
              ? 0
              : (prev[idx].unreadCount || 0) + 1,
        };
        const rest = prev.filter((c) => c.id !== msg.conversationId);
        const next = [updated, ...rest];
        const uid = getSession()?.id;
        if (uid) setCachedConversations(uid, next).catch(() => {});
        return next;
      });
      // Brand-new DM from a user not yet in the list: pull the full list once so
      // it appears live (guarded so a burst of messages doesn't refetch repeatedly).
      if (
        !conversationsRef.current.some((c) => c.id === msg.conversationId) &&
        !fetchingRef.current.has(msg.conversationId)
      ) {
        fetchingRef.current.add(msg.conversationId);
        loadConversations()
          .then((list) => {
            setConversations(list);
            const uid = getSession()?.id;
            if (uid) setCachedConversations(uid, list).catch(() => {});
          })
          .finally(() => fetchingRef.current.delete(msg.conversationId));
      }
    };

    const onPresence = (payload, online) => {
      const userId = payload?.userId;
      const lastActiveAt = payload?.lastActiveAt;
      if (!userId) return;
      if (lastActiveAt) {
        setLastActiveByUser((prev) => ({ ...prev, [userId]: lastActiveAt }));
      } else if (!online) {
        // offline without timestamp — assume now
        setLastActiveByUser((prev) => ({ ...prev, [userId]: new Date().toISOString() }));
      }
      setConversations((prev) =>
        prev.map((c) => {
          let patched = c;
          // patch participants lastActiveAt if present
          const pIdx = (c.participants || []).findIndex((p) => (p.id || p._id || p).toString() === userId.toString());
          if (pIdx >= 0 && lastActiveAt) {
            const newParts = [...c.participants];
            newParts[pIdx] = { ...newParts[pIdx], lastActiveAt };
            patched = { ...patched, participants: newParts };
          }
          const other = otherParticipant(patched, currentUser?.id);
          if (other && other.id === userId) {
            const others = patched.otherParticipantIds || [];
            const onlineArr = others.map((id) =>
              id === userId ? online : patched.online?.[others.indexOf(id)],
            );
            return { ...patched, online: onlineArr };
          }
          return patched;
        }),
      );
    };

    // Authoritative list of peers who are already online when this socket joins.
    const onSnapshot = ({ online }) => {
      if (!Array.isArray(online)) return;
      const set = new Set(online.map(String));
      setConversations((prev) =>
        prev.map((c) => {
          const others = c.otherParticipantIds || [];
          if (!others.length) return c;
          return { ...c, online: others.map((id) => set.has(String(id))) };
        }),
      );
    };

    const onRead = (payload) => {
      if (!payload?.conversationId || payload.userId !== currentUser?.id) return;
      setConversations((prev) => prev.map((c) => (c.id === payload.conversationId ? { ...c, unreadCount: 0 } : c)));
    };
    const onUnread = (payload) => {
      if (!payload?.conversationId || payload.userId !== currentUser?.id) return;
      const count = typeof payload.unreadCount === "number" ? payload.unreadCount : null;
      if (count !== null) {
        setConversations((prev) => prev.map((c) => (c.id === payload.conversationId ? { ...c, unreadCount: count } : c)));
      } else {
        loadConversations().then((list) => setConversations(list));
      }
    };
    socket.on("message:new", onNew);
    socket.on("message:read", onRead);
    socket.on("message:unread", onUnread);
    socket.on("presence:online", (p) => onPresence(p, true));
    socket.on("presence:offline", (p) => onPresence(p, false));
    socket.on("presence:snapshot", onSnapshot);

    // Group membership / settings changes pushed from the server. These keep the
    // conversation list, the open chat, and the settings panel in sync for every
    // member (including the acting user, whose API response also updates state).
    const onMemberAdded = ({ conversation }) => {
      if (conversation) upsertConversation(conversation);
    };
    const onMemberRemoved = ({ conversation }) => {
      if (conversation) upsertConversation(conversation);
    };
    const onConversationUpdated = ({ conversation }) => {
      if (conversation) upsertConversation(conversation);
    };
    const onAdminChanged = ({ conversation }) => {
      if (conversation) upsertConversation(conversation);
    };
    const onConversationRemoved = ({ conversationId }) => {
      if (!conversationId) return;
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== conversationId);
        const uid = getSession()?.id;
        if (uid) setCachedConversations(uid, next).catch(() => {});
        return next;
      });
      setSelectedId((id) => (id === conversationId ? null : id));
      setShowGroupSettings(false);
    };

    socket.on("conversation:member-added", onMemberAdded);
    socket.on("conversation:member-removed", onMemberRemoved);
    socket.on("conversation:updated", onConversationUpdated);
    socket.on("conversation:admin-changed", onAdminChanged);
    socket.on("conversation:removed", onConversationRemoved);

    const onSpaceUpdated = ({ space }) => { if (space) upsertSpace(space); };
    const onSpaceChannel = ({ space }) => {
      if (space) upsertSpace(space);
      loadConversations().then((list) => {
        setConversations(list);
        const uid = getSession()?.id;
        if (uid) setCachedConversations(uid, list).catch(() => {});
      });
    };
    const onSpaceRemoved = ({ spaceId }) => {
      if (!spaceId) return;
      setSpaces((prev) => {
        const next = prev.filter((s) => s.id !== spaceId);
        const uid = getSession()?.id;
        if (uid) setCachedSpaces(uid, next).catch(() => {});
        return next;
      });
      setConversations((prev) => {
        const next = prev.filter((c) => c.spaceId !== spaceId);
        const uid = getSession()?.id;
        if (uid) setCachedConversations(uid, next).catch(() => {});
        return next;
      });
      const selId = selectedIdRef.current;
      const selConv = conversationsRef.current.find((c) => c.id === selId);
      if (selConv?.spaceId === spaceId) setSelectedId(null);
      setShowSpaceSettings(false);
    };
    const onSpaceJoined = ({ space }) => {
      if (space) upsertSpace(space);
      loadConversations().then((list) => {
        setConversations(list);
        const uid = getSession()?.id;
        if (uid) setCachedConversations(uid, list).catch(() => {});
      });
    };

    socket.on("space:updated", onSpaceUpdated);
    socket.on("space:member-added", onSpaceChannel);
    socket.on("space:member-removed", onSpaceChannel);
    socket.on("space:member-updated", onSpaceUpdated);
    socket.on("space:channel-created", onSpaceChannel);
    socket.on("space:channel-updated", onSpaceChannel);
    socket.on("space:channel-deleted", onSpaceChannel);
    socket.on("space:joined", onSpaceJoined);
    socket.on("space:removed", onSpaceRemoved);
    socket.on("space:deleted", onSpaceRemoved);

    return () => {
      socket.off("message:new", onNew);
      socket.off("message:read", onRead);
      socket.off("message:unread", onUnread);
      socket.off("presence:online");
      socket.off("presence:offline");
      socket.off("presence:snapshot", onSnapshot);
      socket.off("conversation:member-added", onMemberAdded);
      socket.off("conversation:member-removed", onMemberRemoved);
      socket.off("conversation:updated", onConversationUpdated);
      socket.off("conversation:admin-changed", onAdminChanged);
      socket.off("conversation:removed", onConversationRemoved);
      socket.off("space:updated", onSpaceUpdated);
      socket.off("space:member-added", onSpaceChannel);
      socket.off("space:member-removed", onSpaceChannel);
      socket.off("space:member-updated", onSpaceUpdated);
      socket.off("space:channel-created", onSpaceChannel);
      socket.off("space:channel-updated", onSpaceChannel);
      socket.off("space:channel-deleted", onSpaceChannel);
      socket.off("space:joined", onSpaceJoined);
      socket.off("space:removed", onSpaceRemoved);
      socket.off("space:deleted", onSpaceRemoved);
    };
  }, [socket, currentUser?.id, loadConversations, upsertConversation, loadSpaces, upsertSpace]);

  // All hooks above run unconditionally. Only now — after every hook has been
  // declared — is it safe to bail out of rendering when the session is gone.
  if (!currentUser) return null;

  const handleCompose = () => {
    setShowFriends(true);
  };

  const handleNewGroup = () => {
    setShowGroupCreate(true);
  };

  // Notifications — bell/center handlers
  const handleBellClick = async () => {
    const willOpen = !notifOpen;
    setNotifOpen(willOpen);
    if (willOpen) {
      // Refresh unread + list when opening (keeps badge/center in sync without polling)
      apiGet("/api/v1/notifications/unread-count")
        .then((d) => setNotifUnread(typeof d?.count === "number" ? d.count : 0))
        .catch(() => {});
      if (notifications.length === 0) {
        setNotifLoading(true);
        apiGet("/api/v1/notifications?limit=20")
          .then((d) => {
            setNotifications(Array.isArray(d?.notifications) ? d.notifications : []);
            setNotifNextCursor(d?.nextCursor || null);
            setNotifHasMore(Boolean(d?.nextCursor));
          })
          .catch(() => {})
          .finally(() => setNotifLoading(false));
      }
      // Explicit user action → may prompt for push permission and subscribe
      if (typeof window !== "undefined" && "Notification" in window) {
        try {
          if (Notification.permission === "default") {
            const perm = await requestPermission();
            if (perm === "granted") await subscribe();
          } else if (Notification.permission === "granted") {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            if (!sub) await subscribe();
          }
        } catch {}
      }
    }
  };

  const handleLoadMoreNotifications = () => {
    if (!notifNextCursor || notifLoading) return;
    setNotifLoading(true);
    apiGet(`/api/v1/notifications?cursor=${notifNextCursor}&limit=20`)
      .then((d) => {
        const more = Array.isArray(d?.notifications) ? d.notifications : [];
        setNotifications((prev) => [...prev, ...more]);
        setNotifNextCursor(d?.nextCursor || null);
        setNotifHasMore(Boolean(d?.nextCursor));
      })
      .catch(() => {})
      .finally(() => setNotifLoading(false));
  };

  const handleMarkAllRead = async () => {
    try {
      await apiPatch("/api/v1/notifications/read", { all: true });
    } catch {}
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setNotifUnread(0);
  };

  const handleNotifSelect = async (notif) => {
    if (!notif) return;
    // Mark single read optimistically
    if (!notif.read) {
      setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)));
      setNotifUnread((c) => Math.max(0, c - 1));
      apiPatch("/api/v1/notifications/read", { ids: [notif.id] }).catch(() => {});
    }
    setNotifOpen(false);
    const t = notif.type;
    if (t === "friend_request" || t === "friend_accept") {
      setShowFriends(true);
      return;
    }
    if (notif.conversationId) {
      // Ensure the conversation is in the local list; if not, reload once
      const exists = conversationsRef.current.some((c) => c.id === notif.conversationId);
      if (!exists) {
        try {
          const list = await loadConversations();
          setConversations(list);
          const uid = getSession()?.id;
          if (uid) setCachedConversations(uid, list).catch(() => {});
        } catch {}
      }
      setSelectedId(notif.conversationId);
      setShowGroupSettings(false);
      setShowSpaceSettings(false);
    }
  };

  // Called from the friends modal when the user picks "Message" on a friend.
  const handleStartChat = async (participantId) => {
    try {
      const conv = await apiPost("/api/v1/conversations", { participantId });
      setConversations((prev) => {
        if (prev.some((c) => c.id === conv.id)) return prev;
        const next = [conv, ...prev];
        const uid = getSession()?.id;
        if (uid) setCachedConversations(uid, next).catch(() => {});
        return next;
      });
      setSelectedId(conv.id);
      setShowGroupSettings(false);
      setShowFriends(false);
    } catch (err) {
      window.alert(err?.message || "Could not start conversation");
    }
  };

  // Called when a group is created from the friends modal's group flow.
  const handleGroupCreated = (conv) => {
    setConversations((prev) => {
      if (prev.some((c) => c.id === conv.id)) return prev;
      const next = [conv, ...prev];
      const uid = getSession()?.id;
      if (uid) setCachedConversations(uid, next).catch(() => {});
      return next;
    });
    setSelectedId(conv.id);
    setShowGroupSettings(false);
    setShowFriends(false);
    setShowGroupCreate(false);
  };

  const handleSpaceCreated = (space) => {
    upsertSpace(space);
    loadSpaces().then((list) => {
      setSpaces(list);
      const uid = getSession()?.id;
      if (uid) setCachedSpaces(uid, list).catch(() => {});
    });
    loadConversations().then((list) => {
      setConversations(list);
      const uid = getSession()?.id;
      if (uid) setCachedConversations(uid, list).catch(() => {});
    });
    setShowSpaceCreate(false);
    // auto-select first channel if available
    if (space.channels?.[0]) {
      // channel conversation will appear after reload; select after short delay
      setTimeout(() => {
        const chan = space.channels[0];
        // find conversation for this channel (will be in conversations after reload)
      }, 400);
    }
  };

  const handleDiscoverJoined = (space) => {
    upsertSpace(space);
    loadSpaces().then((list) => {
      setSpaces(list);
      const uid = getSession()?.id;
      if (uid) setCachedSpaces(uid, list).catch(() => {});
    });
    loadConversations().then((list) => {
      setConversations(list);
      const uid = getSession()?.id;
      if (uid) setCachedConversations(uid, list).catch(() => {});
    });
  };

  // Selecting any conversation closes an open group-settings drawer.
  const handleSelect = (id) => {
    setShowGroupSettings(false);
    setShowSpaceSettings(false);
    setSelectedId(id);
  };

  const handleMarkUnread = async (conversationId, messageId) => {
    try {
      const body = messageId ? { messageId } : {};
      const res = await apiPost(`/api/v1/conversations/${conversationId}/unread`, body);
      const data = res?.data || res;
      const unreadCount = typeof data?.unreadCount === "number" ? data.unreadCount : null;
      if (typeof unreadCount === "number") {
        setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, unreadCount } : c)));
        const uid = getSession()?.id;
        if (uid) {
          const next = conversationsRef.current.map((c) => (c.id === conversationId ? { ...c, unreadCount } : c));
          setCachedConversations(uid, next).catch(() => {});
        }
      } else {
        const list = await loadConversations();
        setConversations(list);
      }
    } catch (e) {
      window.alert(e?.message || "Could not mark as unread");
    }
  };

  // Search result handlers
  const handleSearchMessage = useCallback((msg) => {
    if (!msg.conversationId) return;
    setSelectedId(msg.conversationId);
    setShowGroupSettings(false);
    setShowSpaceSettings(false);
    // Delay to allow conversation to mount, then trigger highlight
    setHighlightMessageId(msg.id);
  }, []);

  const handleSearchUser = useCallback((user) => {
    if (user.username) {
      // Open profile drawer by username
      setProfileUsernameSearch(user.username);
    }
  }, []);
  const [profileUsernameSearch, setProfileUsernameSearch] = useState(null);

  const handleSearchSpace = useCallback((space) => {
    // Find the space channel conversation in the list
    const channelConv = conversationsRef.current.find(
      (c) => c.type === "space_channel" && c.spaceId === space.id
    );
    if (channelConv) {
      setSelectedId(channelConv.id);
      setShowGroupSettings(false);
      setShowSpaceSettings(false);
    }
  }, []);

  const selected = conversations.find((c) => c.id === selectedId) || null;
  const selectedSpace = selected?.type === "space_channel" ? spaces.find((s) => s.id === selected.spaceId) || null : null;
  const listItems = conversations.map((c) => toListItem(c, currentUser, spaces));
  const tabUnread = {
    chats: conversations.some((c) => c.type === "dm" && (c.unreadCount || 0) > 0),
    groups: conversations.some((c) => c.type === "group" && (c.unreadCount || 0) > 0),
    spaces: conversations.some((c) => c.type === "space_channel" && (c.unreadCount || 0) > 0),
    settings: false,
    profile: false,
  };

  // The "other" participant of the open DM, used by the detail panel.
  const selectedOtherOnline = selected
    ? Array.isArray(selected.online)
      ? Boolean(selected.online[0])
      : Boolean(selected.online)
    : false;
  const selectedOtherLastActive =
    selectedOtherId
      ? lastActiveByUser[selectedOtherId] ||
        selected?.participants?.find((p) => (p.id || p._id || p).toString() === selectedOtherId)?.lastActiveAt ||
        otherProfile?.lastActiveAt ||
        null
      : null;
  const showUserPanel = Boolean(
    selected && selected.type === "dm" && selectedOtherId,
  );

  // Notification bell node — passed into Sidebar's topbar; center is anchored to bell via relative wrapper
  const notificationBellNode = (
    <div id="kivo-notification-bell-wrap" className="relative">
      <NotificationBell unreadCount={notifUnread} onClick={handleBellClick} isOpen={notifOpen} />
      <NotificationCenter
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={notifications}
        nextCursor={notifNextCursor}
        hasMore={notifHasMore}
        loading={notifLoading}
        onLoadMore={handleLoadMoreNotifications}
        onMarkAllRead={handleMarkAllRead}
        onSelect={handleNotifSelect}
        unreadCount={notifUnread}
      />
    </div>
  );

  // Mobile: native-like fixed viewport — no rubber-band, no back-area scroll
  if (!isDesktop) {
    return (
      <div className="fixed inset-0 flex h-[100dvh] w-screen flex-col overflow-hidden overscroll-none bg-[var(--bg-base)] touch-none" style={{ overscrollBehavior: "none", touchAction: "none" }}>
        <AnimatePresence initial={false}>
          {selected ? (
            <motion.div
              key="chat"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={slide}
              drag={reduce || panelDragDisabled ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.22}
              dragMomentum={false}
              dragDirectionLock
              onDragStart={(_, info) => {
                if (chatSwipeIgnoreRef.current) return false;
              }}
              onDrag={(_, info) => {
                if (chatSwipeIgnoreRef.current) return;
                // only right swipe (positive) drives back affordance
                const dx = info.offset.x;
                if (dx <= 0) return;
                const p = Math.min(dx / 90, 1);
                setSwipeProgress(p);
              }}
              onDragEnd={(_, info) => {
                const wasBubble = chatSwipeIgnoreRef.current;
                setSwipeProgress(0);
                chatSwipeIgnoreRef.current = false;
                setPanelDragDisabled(false);
                if (wasBubble) return;
                const offset = info?.offset?.x ?? 0;
                const velocity = info?.velocity?.x ?? 0;
                // only right swipe should go back — left swipe is ignored
                if ((offset > 90 || velocity > 700) && offset > 0) setSelectedId(null);
              }}
              onPointerDown={(e) => {
                const target = e.target;
                const isBubble =
                  target.closest?.('[data-slot="bubble"]') ||
                  target.closest?.('[data-slot="bubble-content"]') ||
                  target.closest?.('.t-bubble');
                if (isBubble) {
                  chatSwipeIgnoreRef.current = true;
                  setPanelDragDisabled(true);
                }
              }}
              onTouchStart={(e) => {
                const t = e.touches?.[0];
                if (!t) return;
                const target = e.target;
                const isBubble =
                  target.closest?.('[data-slot="bubble"]') ||
                  target.closest?.('[data-slot="bubble-content"]') ||
                  target.closest?.('.t-bubble') ||
                  target.closest?.('[data-slot="bubble-group"]');
                // back swipe is edge-only (<=32px from left); bubbles always block back
                const isEdge = t.clientX <= 32;
                const shouldIgnore = !!isBubble || !isEdge;
                chatSwipeIgnoreRef.current = shouldIgnore;
                setPanelDragDisabled(shouldIgnore);
                chatSwipeStartRef.current = { x: t.clientX, y: t.clientY };
                chatSwipeIsHorizontalRef.current = false;
              }}
              onTouchMove={(e) => {
                if (chatSwipeIgnoreRef.current) return;
                const t = e.touches?.[0];
                if (!t) return;
                const dx = t.clientX - chatSwipeStartRef.current.x;
                const dy = t.clientY - chatSwipeStartRef.current.y;
                if (!chatSwipeIsHorizontalRef.current && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
                  chatSwipeIsHorizontalRef.current = true;
                }
                if (chatSwipeIsHorizontalRef.current && dx > 12) {
                  if (e.cancelable) e.preventDefault();
                  const p = Math.min(dx / 90, 1);
                  setSwipeProgress(p);
                } else if (chatSwipeIsHorizontalRef.current && dx < 0) {
                  // left swipe on non-bubble edge area — don't drive back progress
                  setSwipeProgress(0);
                }
              }}
              onTouchEnd={() => {
                chatSwipeIsHorizontalRef.current = false;
                chatSwipeIgnoreRef.current = false;
                setPanelDragDisabled(false);
                setSwipeProgress(0);
              }}
              className="absolute inset-0 bg-[var(--bg-base)] touch-pan-y overscroll-x-contain overscroll-contain"
              style={{ touchAction: "pan-y", overscrollBehavior: "contain" }}
            >
              {/* Swipe indicator — dark pill with "< Back", blur smooth (keep) */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2"
                style={{
                  opacity: swipeProgress,
                  filter: reduce ? undefined : `blur(${(1 - swipeProgress) * 6}px)`,
                  transform: `translateY(-50%) translateX(${(1 - swipeProgress) * -12}px)`,
                  transition: "opacity 180ms cubic-bezier(0.22,1,0.36,1), filter 220ms cubic-bezier(0.22,1,0.36,1), transform 220ms cubic-bezier(0.22,1,0.36,1)",
                }}
              >
                <div className="flex items-center gap-1.5 rounded-full bg-[#1c1c1c] border border-[#2a2a2a] px-3 py-1.5 shadow-lg">
                  <span className="text-[13px] font-medium text-white">&lt; Back</span>
                </div>
              </div>
              <ChatPanel
                conversation={selected}
                space={selectedSpace}
                onBack={() => setSelectedId(null)}
                onOpenGroupSettings={() => {
                  if (selected?.type === "space_channel") setShowSpaceSettings(true);
                  else setShowGroupSettings(true);
                }}
                onConversationUpdate={upsertConversation}
                isOffline={isOffline}
                highlightMessageId={highlightMessageId}
                onHighlightCleared={() => setHighlightMessageId(null)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ x: 0 }}
              animate={{ x: 0 }}
              exit={{ x: "-28%" }}
              transition={slide}
              className="absolute inset-0 flex flex-col bg-[var(--bg-base)]"
            >
              <div className="min-h-0 flex-1 overflow-hidden">
                {mobileTab === "chats" && (
                  <div className="h-full pb-[calc(56px+env(safe-area-inset-bottom))] overflow-hidden">
                    <Sidebar
                      conversations={listItems}
                      selectedId={selectedId}
                      onSelect={handleSelect}
                      collapsed={false}
                      showToggle={false}
                      onCompose={handleCompose}
                      onNewGroup={handleNewGroup}
                      onCreateSpace={() => setShowSpaceCreate(true)}
                      onDiscoverSpaces={() => setShowDiscover(true)}
                      spaces={spaces}
                      currentUser={currentUser}
                      onProfileUpdate={refreshUser}
                      notificationBell={notificationBellNode}
                      hideSpaces
                      hideGroups
                      isOffline={isOffline}
                      onSearchOpen={() => setSearchOpen(true)}
                      onMarkUnread={(id) => handleMarkUnread(id)}
                    />
                  </div>
                )}
                {mobileTab === "groups" && (
                  <div className="h-full pb-[calc(56px+env(safe-area-inset-bottom))] overflow-hidden">
                    <Sidebar
                      conversations={listItems}
                      selectedId={selectedId}
                      onSelect={handleSelect}
                      collapsed={false}
                      showToggle={false}
                      onCompose={handleCompose}
                      onNewGroup={handleNewGroup}
                      onCreateSpace={() => setShowSpaceCreate(true)}
                      onDiscoverSpaces={() => setShowDiscover(true)}
                      spaces={spaces}
                      currentUser={currentUser}
                      onProfileUpdate={refreshUser}
                      notificationBell={notificationBellNode}
                      hideSpaces
                      hideDMs
                      isOffline={isOffline}
                      onSearchOpen={() => setSearchOpen(true)}
                      onMarkUnread={(id) => handleMarkUnread(id)}
                    />
                  </div>
                )}
                {mobileTab === "spaces" && (
                  <MobileSpacesTab
                    spaces={spaces}
                    channels={listItems.filter((c) => c.type === "space_channel")}
                    onSelect={handleSelect}
                    onCreateSpace={() => setShowSpaceCreate(true)}
                    onDiscover={() => setShowDiscover(true)}
                  />
                )}
                {mobileTab === "settings" && <MobileSettingsTab />}
                {mobileTab === "profile" && (
                  <MobileProfileTab currentUser={currentUser} onProfileUpdate={refreshUser} />
                )}
              </div>
              <BottomTabBar
                active={mobileTab}
                onChange={(id) => {
                  setMobileTab(id);
                }}
                unread={tabUnread}
              />
            </motion.div>
          )}
        </AnimatePresence>
      <FriendsModal
        open={showFriends}
        onClose={() => setShowFriends(false)}
        onStartChat={handleStartChat}
      />

      <GroupCreateModal
        open={showGroupCreate}
        onClose={() => setShowGroupCreate(false)}
        onCreated={handleGroupCreated}
      />

      <SpaceCreateModal
        open={showSpaceCreate}
        onClose={() => setShowSpaceCreate(false)}
        onCreated={handleSpaceCreated}
      />

      <SpaceDiscoverModal
        open={showDiscover}
        onClose={() => {
          setShowDiscover(false);
          setPendingInvite(null);
        }}
        onJoined={handleDiscoverJoined}
        invitePrefill={pendingInvite}
      />

      <SearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectMessage={handleSearchMessage}
        onSelectUser={handleSearchUser}
        onSelectSpace={handleSearchSpace}
      />

      <GroupSettingsOverlay
        open={selected?.type === "group" && showGroupSettings}
        conversation={selected}
        onClose={() => setShowGroupSettings(false)}
        onConversationUpdate={upsertConversation}
        onLeft={() => {
          setShowGroupSettings(false);
          setSelectedId(null);
        }}
      />
      <SpaceSettingsOverlay
        open={selected?.type === "space_channel" && showSpaceSettings}
        space={selectedSpace}
        onClose={() => setShowSpaceSettings(false)}
        onUpdated={upsertSpace}
        onDeleted={(id) => {
          setSpaces((prev) => {
            const next = prev.filter((s) => s.id !== id);
            const uid = getSession()?.id;
            if (uid) setCachedSpaces(uid, next).catch(() => {});
            return next;
          });
          setConversations((prev) => {
            const next = prev.filter((c) => c.spaceId !== id);
            const uid = getSession()?.id;
            if (uid) setCachedConversations(uid, next).catch(() => {});
            return next;
          });
          setSelectedId(null);
          setShowSpaceSettings(false);
        }}
        onLeft={(id) => {
          setSpaces((prev) => {
            const next = prev.filter((s) => s.id !== id);
            const uid = getSession()?.id;
            if (uid) setCachedSpaces(uid, next).catch(() => {});
            return next;
          });
          setConversations((prev) => {
            const next = prev.filter((c) => c.spaceId !== id);
            const uid = getSession()?.id;
            if (uid) setCachedConversations(uid, next).catch(() => {});
            return next;
          });
          setSelectedId(null);
          setShowSpaceSettings(false);
        }}
      />

      <ProfileDrawer
        username={profileUsernameSearch}
        open={Boolean(profileUsernameSearch)}
        onClose={() => setProfileUsernameSearch(null)}
        onMessage={(conv) => {
          setProfileUsernameSearch(null);
          if (conv) {
            setConversations((prev) => {
              if (prev.some((c) => c.id === conv.id)) return prev;
              return [conv, ...prev];
            });
            setSelectedId(conv.id);
          }
        }}
      />
    </div>
  );
  }

  // Desktop: nested icon-rail + panel sidebar + chat side by side.
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--bg-base)]">
      <div className="flex min-h-0 flex-1">
      <div className="hidden h-full shrink-0 overflow-hidden border-r border-[var(--border)] bg-[var(--bg-elevated)] md:flex md:w-[384px]">
        <NestedSidebar
          conversations={listItems}
          selectedId={selectedId}
          onSelect={handleSelect}
          spaces={spaces}
          currentUser={currentUser}
          onProfileUpdate={refreshUser}
          notificationBell={notificationBellNode}
          isOffline={isOffline}
          onSearchOpen={() => setSearchOpen(true)}
          onMarkUnread={(id) => handleMarkUnread(id)}
          onCompose={handleCompose}
          onNewGroup={handleNewGroup}
          onCreateSpace={() => setShowSpaceCreate(true)}
          onDiscoverSpaces={() => setShowDiscover(true)}
          unread={tabUnread}
        />
      </div>

      <div className="flex h-full min-w-0 flex-1 flex-col">
        <ChatPanel
          conversation={selected}
          space={selectedSpace}
          onOpenGroupSettings={() => {
            if (selected?.type === "space_channel") setShowSpaceSettings(true);
            else setShowGroupSettings(true);
          }}
          onConversationUpdate={upsertConversation}
          isOffline={isOffline}
          highlightMessageId={highlightMessageId}
          onHighlightCleared={() => setHighlightMessageId(null)}
        />
      </div>

      <AnimatePresence mode="wait">
        {showUserPanel ? (
          <UserPanel
            key={selectedOtherId}
            profile={otherProfile}
            loading={otherLoading}
            online={selectedOtherOnline}
            lastActiveAt={selectedOtherLastActive}
            conversationCreatedAt={selected?.createdAt}
            conversation={selected}
            onConversationUpdate={upsertConversation}
          />
        ) : null}
      </AnimatePresence>

      <GroupSettingsOverlay
        open={selected?.type === "group" && showGroupSettings}
        conversation={selected}
        onClose={() => setShowGroupSettings(false)}
        onConversationUpdate={upsertConversation}
        onLeft={() => {
          setShowGroupSettings(false);
          setSelectedId(null);
        }}
      />
      <SpaceSettingsOverlay
        open={selected?.type === "space_channel" && showSpaceSettings}
        space={selectedSpace}
        onClose={() => setShowSpaceSettings(false)}
        onUpdated={upsertSpace}
        onDeleted={(id) => {
          setSpaces((prev) => {
            const next = prev.filter((s) => s.id !== id);
            const uid = getSession()?.id;
            if (uid) setCachedSpaces(uid, next).catch(() => {});
            return next;
          });
          setConversations((prev) => {
            const next = prev.filter((c) => c.spaceId !== id);
            const uid = getSession()?.id;
            if (uid) setCachedConversations(uid, next).catch(() => {});
            return next;
          });
          setSelectedId(null);
          setShowSpaceSettings(false);
        }}
        onLeft={(id) => {
          setSpaces((prev) => {
            const next = prev.filter((s) => s.id !== id);
            const uid = getSession()?.id;
            if (uid) setCachedSpaces(uid, next).catch(() => {});
            return next;
          });
          setConversations((prev) => {
            const next = prev.filter((c) => c.spaceId !== id);
            const uid = getSession()?.id;
            if (uid) setCachedConversations(uid, next).catch(() => {});
            return next;
          });
          setSelectedId(null);
          setShowSpaceSettings(false);
        }}
      />

      <FriendsModal
        open={showFriends}
        onClose={() => setShowFriends(false)}
        onStartChat={handleStartChat}
      />

      <GroupCreateModal
        open={showGroupCreate}
        onClose={() => setShowGroupCreate(false)}
        onCreated={handleGroupCreated}
      />

      <SpaceCreateModal
        open={showSpaceCreate}
        onClose={() => setShowSpaceCreate(false)}
        onCreated={handleSpaceCreated}
      />

      <SpaceDiscoverModal
        open={showDiscover}
        onClose={() => {
          setShowDiscover(false);
          setPendingInvite(null);
        }}
        onJoined={handleDiscoverJoined}
        invitePrefill={pendingInvite}
      />

      <SearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectMessage={handleSearchMessage}
        onSelectUser={handleSearchUser}
        onSelectSpace={handleSearchSpace}
      />

      <ProfileDrawer
        username={profileUsernameSearch}
        open={Boolean(profileUsernameSearch)}
        onClose={() => setProfileUsernameSearch(null)}
        onMessage={(conv) => {
          setProfileUsernameSearch(null);
          if (conv) {
            setConversations((prev) => {
              if (prev.some((c) => c.id === conv.id)) return prev;
              return [conv, ...prev];
            });
            setSelectedId(conv.id);
          }
        }}
      />

      </div>
    </div>
  );
}

export default DashboardShell;
