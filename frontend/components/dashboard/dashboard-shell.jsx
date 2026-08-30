"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "@/components/socket-provider";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { getSession, getToken, setSession } from "@/lib/auth";
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
import { SpaceCreateModal } from "@/components/spaces/space-create-modal";
import { SpaceSettingsPanel } from "@/components/spaces/space-settings-panel";
import { SpaceDiscoverModal } from "@/components/spaces/space-discover-modal";

// Group settings surface: a slide-in drawer on smaller screens (with a dimmed
// backdrop) and a persistent side column on wide desktops (xl+). The inner
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
          className="fixed inset-0 z-30 bg-black/40 xl:hidden"
        />
      )}
      {open && conversation && (
        <motion.aside
          key="gs-drawer"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={slide}
          className="fixed right-0 top-0 z-40 h-[100dvh] w-[320px] max-w-[88vw] border-l border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl xl:static xl:z-auto xl:h-full xl:max-w-none xl:shadow-none"
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
          className="fixed inset-0 z-30 bg-black/40 xl:hidden"
        />
      )}
      {open && space && (
        <motion.aside
          key="ss-drawer"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={slide}
          className="fixed right-0 top-0 z-40 h-[100dvh] w-[360px] max-w-[88vw] border-l border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl xl:static xl:z-auto xl:h-full xl:max-w-none xl:shadow-none"
        >
          <SpaceSettingsPanel space={space} onClose={onClose} onUpdated={onUpdated} onDeleted={onDeleted} onLeft={onLeft} />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
import { UserPanel } from "./user-panel";

// Restrained easing — matches the rest of the app (no bounce).
const EASE = [0.22, 1, 0.36, 1];
const COLLAPSE_KEY = "kivo:sidebar-collapsed";
const SELECTED_KEY = "kivo:selected-conversation";
const MOBILE_QUERY = "(min-width: 768px)";

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
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
  const socket = useSocket();
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
      if (idx === -1) return [space, ...prev];
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...space };
      return copy;
    });
  }, []);

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
      if (idx === -1) return [merged, ...prev];
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        ...merged,
        unreadCount: merged.unreadCount ?? copy[idx].unreadCount,
      };
      return copy;
    });
  }, []);

  // Load spaces once on mount.
  useEffect(() => {
    let active = true;
    loadSpaces()
      .then((data) => {
        if (!active) return;
        setSpaces(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (active) setSpaces([]);
      });
    return () => {
      active = false;
    };
  }, [loadSpaces]);

  // Load the conversation list once on mount.
  useEffect(() => {
    let active = true;
    loadConversations()
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : [];
        setConversations(list);
        // The open conversation may have been restored from localStorage before
        // this fetch resolved — clear its unread now so the badge doesn't stick.
        const restored = selectedIdRef.current;
        if (restored && list.some((c) => c.id === restored)) {
          apiPatch(`/api/v1/conversations/${restored}/read`, {}).catch(
            () => {},
          );
          setConversations((prev) =>
            prev.map((c) => (c.id === restored ? { ...c, unreadCount: 0 } : c)),
          );
        }
      })
      .catch(() => {
        if (active) setConversations([]);
      });
    return () => {
      active = false;
    };
  }, [loadConversations]);

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
    setConversations((prev) =>
      prev.map((c) => (c.id === selectedId ? { ...c, unreadCount: 0 } : c)),
    );
    return undefined;
  }, [selectedId]);

  // Global realtime updates for the conversation list.
  useEffect(() => {
    if (!socket) return undefined;

    const onNew = (msg) => {
      if (!msg?.conversationId) return;
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
        return [updated, ...rest];
      });
      // Brand-new DM from a user not yet in the list: pull the full list once so
      // it appears live (guarded so a burst of messages doesn't refetch repeatedly).
      if (
        !conversationsRef.current.some((c) => c.id === msg.conversationId) &&
        !fetchingRef.current.has(msg.conversationId)
      ) {
        fetchingRef.current.add(msg.conversationId);
        loadConversations()
          .then((list) => setConversations(list))
          .finally(() => fetchingRef.current.delete(msg.conversationId));
      }
    };

    const onPresence = (userId, online) => {
      if (!userId) return;
      setConversations((prev) =>
        prev.map((c) => {
          const other = otherParticipant(c, currentUser?.id);
          if (other && other.id === userId) {
            const others = c.otherParticipantIds || [];
            const onlineArr = others.map((id) =>
              id === userId ? online : c.online?.[others.indexOf(id)],
            );
            return { ...c, online: onlineArr };
          }
          return c;
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

    socket.on("message:new", onNew);
    socket.on("presence:online", (p) => onPresence(p?.userId, true));
    socket.on("presence:offline", (p) => onPresence(p?.userId, false));
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
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      setSelectedId((id) => (id === conversationId ? null : id));
      setShowGroupSettings(false);
    };

    socket.on("conversation:member-added", onMemberAdded);
    socket.on("conversation:member-removed", onMemberRemoved);
    socket.on("conversation:updated", onConversationUpdated);
    socket.on("conversation:admin-changed", onAdminChanged);
    socket.on("conversation:removed", onConversationRemoved);

    const onSpaceUpdated = ({ space }) => { if (space) upsertSpace(space); };
    const onSpaceChannel = ({ space }) => { if (space) upsertSpace(space); loadConversations().then((list) => setConversations(list)); };
    const onSpaceRemoved = ({ spaceId }) => {
      if (!spaceId) return;
      setSpaces((prev) => prev.filter((s) => s.id !== spaceId));
      const selId = selectedIdRef.current;
      const selConv = conversationsRef.current.find((c) => c.id === selId);
      if (selConv?.spaceId === spaceId) setSelectedId(null);
      setShowSpaceSettings(false);
    };
    const onSpaceJoined = ({ space }) => {
      if (space) upsertSpace(space);
      loadConversations().then((list) => setConversations(list));
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

  // Called from the friends modal when the user picks "Message" on a friend.
  const handleStartChat = async (participantId) => {
    try {
      const conv = await apiPost("/api/v1/conversations", { participantId });
      setConversations((prev) => {
        if (prev.some((c) => c.id === conv.id)) return prev;
        return [conv, ...prev];
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
      return [conv, ...prev];
    });
    setSelectedId(conv.id);
    setShowGroupSettings(false);
    setShowFriends(false);
    setShowGroupCreate(false);
  };

  const handleSpaceCreated = (space) => {
    upsertSpace(space);
    loadSpaces().then((list) => setSpaces(list));
    loadConversations().then((list) => setConversations(list));
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
    loadSpaces().then((list) => setSpaces(list));
    loadConversations().then((list) => setConversations(list));
  };

  // Selecting any conversation closes an open group-settings drawer.
  const handleSelect = (id) => {
    setShowGroupSettings(false);
    setShowSpaceSettings(false);
    setSelectedId(id);
  };

  const selected = conversations.find((c) => c.id === selectedId) || null;
  const selectedSpace = selected?.type === "space_channel" ? spaces.find((s) => s.id === selected.spaceId) || null : null;
  const listItems = conversations.map((c) => toListItem(c, currentUser, spaces));

  // The "other" participant of the open DM, used by the detail panel.
  const selectedOtherOnline = selected
    ? Array.isArray(selected.online)
      ? Boolean(selected.online[0])
      : Boolean(selected.online)
    : false;
  const showUserPanel = Boolean(
    selected && selected.type === "dm" && selectedOtherId,
  );

  // Mobile: stack navigation.
  if (!isDesktop) {
    return (
      <div className="relative h-[100dvh] overflow-hidden bg-[var(--bg-base)]">
        <AnimatePresence initial={false}>
          {selected ? (
            <motion.div
              key="chat"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={slide}
              className="absolute inset-0 bg-[var(--bg-base)]"
            >
              <ChatPanel
                conversation={selected}
                space={selectedSpace}
                onBack={() => setSelectedId(null)}
                onOpenGroupSettings={() => {
                  if (selected?.type === "space_channel") setShowSpaceSettings(true);
                  else setShowGroupSettings(true);
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ x: 0 }}
              animate={{ x: 0 }}
              exit={{ x: "-28%" }}
              transition={slide}
              className="absolute inset-0 bg-[var(--bg-base)]"
            >
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
        onClose={() => setShowDiscover(false)}
        onJoined={handleDiscoverJoined}
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
          setSpaces((prev) => prev.filter((s) => s.id !== id));
          setConversations((prev) => prev.filter((c) => c.spaceId !== id));
          setSelectedId(null);
          setShowSpaceSettings(false);
        }}
        onLeft={(id) => {
          setSpaces((prev) => prev.filter((s) => s.id !== id));
          setConversations((prev) => prev.filter((c) => c.spaceId !== id));
          setSelectedId(null);
          setShowSpaceSettings(false);
        }}
      />
    </div>
  );
}

  // Desktop: sidebar + chat side by side.
  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[var(--bg-base)]">
      <motion.div
        animate={{ width: collapsed ? 76 : 320 }}
        transition={reduce ? { duration: 0 } : { duration: 0.28, ease: EASE }}
        className="h-full shrink-0 overflow-hidden border-r border-[var(--border)] bg-[var(--bg-elevated)]"
      >
        <Sidebar
          conversations={listItems}
          selectedId={selectedId}
          onSelect={handleSelect}
          collapsed={collapsed}
          showToggle
          onToggle={() => setCollapsed((v) => !v)}
          onCompose={handleCompose}
          onNewGroup={handleNewGroup}
          onCreateSpace={() => setShowSpaceCreate(true)}
          onDiscoverSpaces={() => setShowDiscover(true)}
          spaces={spaces}
          currentUser={currentUser}
          onProfileUpdate={refreshUser}
        />
      </motion.div>

      <div className="flex h-full min-w-0 flex-1 flex-col">
        <ChatPanel
          conversation={selected}
          space={selectedSpace}
          onOpenGroupSettings={() => {
            if (selected?.type === "space_channel") setShowSpaceSettings(true);
            else setShowGroupSettings(true);
          }}
        />
      </div>

      <AnimatePresence mode="wait">
        {showUserPanel ? (
          <UserPanel
            key={selectedOtherId}
            profile={otherProfile}
            loading={otherLoading}
            online={selectedOtherOnline}
            conversationCreatedAt={selected?.createdAt}
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
          setSpaces((prev) => prev.filter((s) => s.id !== id));
          setConversations((prev) => prev.filter((c) => c.spaceId !== id));
          setSelectedId(null);
          setShowSpaceSettings(false);
        }}
        onLeft={(id) => {
          setSpaces((prev) => prev.filter((s) => s.id !== id));
          setConversations((prev) => prev.filter((c) => c.spaceId !== id));
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
        onClose={() => setShowDiscover(false)}
        onJoined={handleDiscoverJoined}
      />

    </div>
  );
}

export default DashboardShell;
