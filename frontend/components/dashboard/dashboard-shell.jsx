"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/components/socket-provider";
import { apiGet, apiPost } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { formatTime, otherParticipant, participantName } from "@/lib/chat";
import { ChatPanel } from "./chat-panel";
import { FriendsModal } from "./friends-modal";
import { Sidebar } from "./sidebar";

// Restrained easing — matches the rest of the app (no bounce).
const EASE = [0.22, 1, 0.36, 1];
const COLLAPSE_KEY = "kivo:sidebar-collapsed";
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
function toListItem(c, currentUser) {
  const other = otherParticipant(c, currentUser?.id);
  const online = Array.isArray(c.online) ? c.online.some(Boolean) : false;
  return {
    id: c.id,
    name: c.type === "group" ? c.name || "Group" : participantName(other),
    type: c.type,
    lastMessage: c.lastMessagePreview || "",
    time: formatTime(c.lastMessageAt),
    unread: c.unreadCount || 0,
    online,
  };
}

export function DashboardShell() {
  const isDesktop = useIsDesktop();
  const reduce = useReducedMotion();
  const [selectedId, setSelectedId] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [showFriends, setShowFriends] = useState(false);
  const socket = useSocket();
  const currentUser = getSession();
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

  // Load the conversation list once on mount.
  useEffect(() => {
    let active = true;
    apiGet("/api/v1/conversations")
      .then((data) => {
        if (active) setConversations(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (active) setConversations([]);
      });
    return () => {
      active = false;
    };
  }, []);

  // Mark the opened conversation as read (clears its unread badge).
  useEffect(() => {
    if (!selectedId) return undefined;
    apiPost(`/api/v1/conversations/${selectedId}/read`, {}).catch(() => {});
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
        const updated = {
          ...prev[idx],
          lastMessageAt: msg.createdAt,
          lastMessagePreview: msg.isDeleted ? "" : msg.content,
          unreadCount:
            msg.senderId === currentUser?.id
              ? prev[idx].unreadCount
              : (prev[idx].unreadCount || 0) + 1,
        };
        const rest = prev.filter((c) => c.id !== msg.conversationId);
        return [updated, ...rest];
      });
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

    socket.on("message:new", onNew);
    socket.on("presence:online", (p) => onPresence(p?.userId, true));
    socket.on("presence:offline", (p) => onPresence(p?.userId, false));

    return () => {
      socket.off("message:new", onNew);
      socket.off("presence:online");
      socket.off("presence:offline");
    };
  }, [socket, currentUser?.id]);

  // All hooks above run unconditionally. Only now — after every hook has been
  // declared — is it safe to bail out of rendering when the session is gone.
  if (!currentUser) return null;

  const handleCompose = () => {
    setShowFriends(true);
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
      setShowFriends(false);
    } catch (err) {
      window.alert(err?.message || "Could not start conversation");
    }
  };

  const selected = conversations.find((c) => c.id === selectedId) || null;
  const listItems = conversations.map((c) => toListItem(c, currentUser));

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
                onBack={() => setSelectedId(null)}
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
                onSelect={setSelectedId}
                collapsed={false}
                showToggle={false}
                onCompose={handleCompose}
                currentUser={currentUser}
              />
            </motion.div>
          )}
        </AnimatePresence>
        <FriendsModal
          open={showFriends}
          onClose={() => setShowFriends(false)}
          onStartChat={handleStartChat}
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
          onSelect={setSelectedId}
          collapsed={collapsed}
          showToggle
          onToggle={() => setCollapsed((v) => !v)}
          onCompose={handleCompose}
          currentUser={currentUser}
        />
      </motion.div>

      <div className="flex h-full min-w-0 flex-1 flex-col">
        <ChatPanel conversation={selected} />
      </div>

      <FriendsModal
        open={showFriends}
        onClose={() => setShowFriends(false)}
        onStartChat={handleStartChat}
      />
    </div>
  );
}

export default DashboardShell;
