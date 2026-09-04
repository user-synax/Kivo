"use client";

import {
    ArrowDown,
    ArrowUp,
    Ban,
    CheckCheck,
    ChevronLeft,
    Copy,
    Forward,
    Lock,
    MessageSquareText,
    Mic,
    MoreVertical,
    Paperclip,
    Palette,
    Pin,
    Reply,
    Send,
    ShieldBan,
    Trash,
    User,
    UserMinus,
    Users,
    X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import React, {
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";
import { UploadPreview } from "@/components/chat/attachments";
import { Avatar } from "@/components/dashboard/avatar";
import { ConversationLookModal } from "@/components/dashboard/conversation-look-modal";
import { EmojiPicker } from "@/components/dashboard/emoji-picker";
import { MessageBubble } from "@/components/dashboard/message-bubble";
import { ThreadPanel } from "@/components/dashboard/thread-panel";
import { MentionAutocomplete } from "@/components/mentions/mention-autocomplete";
import { ProfileDrawer } from "@/components/profile/profile-drawer";
import { useSocket } from "@/components/socket-provider";
import { useTheme } from "@/components/theme-provider";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { copyText, messageText } from "@/lib/clipboard";
import {
    getCachedMessages,
    mergeCachedMessage,
    setCachedMessages,
} from "@/lib/cache";
import {
    dayKey,
    formatDayDivider,
    otherParticipant,
    participantAvatarName,
    participantName,
} from "@/lib/chat";
import { clearDraft, draftsKey, loadDraft, saveDraft } from "@/lib/drafts";
import { useLiveLastActive } from "@/lib/last-active";
import {
    enqueueOutbox,
    getOutboxSnapshot,
    getPendingOutbox,
    removeOutbox,
    setOutboxStatus,
    subscribeOutbox,
} from "@/lib/outbox";
import { cssVarsForColors, customIsActive, derivePalette } from "@/lib/theme";
import {
  resolveChatLook,
  wallpaperCss,
} from "@/lib/chat-style";
import { useIsDesktop } from "@/lib/use-breakpoint";
import { uploadSingleFileObject, useFileUpload } from "@/lib/use-file-upload";

const TYPING_IDLE_MS = 1500;
// Messages from the same sender within this window are visually grouped.
const GROUP_WINDOW_MS = 60000;

function SwipeToReply({ children, onReply, enabled }) {
    const [offset, setOffset] = useState(0);
    const startRef = useRef(null);
    const lockRef = useRef(null); // null | 'h' | 'v'

    if (!enabled) return children;

    const onTouchStart = (e) => {
        const t = e.touches[0];
        if (!t) return;
        startRef.current = { x: t.clientX, y: t.clientY };
        lockRef.current = null;
    };
    const onTouchMove = (e) => {
        if (!startRef.current) return;
        const t = e.touches[0];
        if (!t) return;
        const dx = t.clientX - startRef.current.x;
        const dy = t.clientY - startRef.current.y;

        // direction lock — decide once
        if (lockRef.current === null) {
            if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
                lockRef.current = "v";
                return;
            }
            if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.1) {
                lockRef.current = "h";
            } else {
                return;
            }
        }
        if (lockRef.current === "v") return;

        // horizontal swipe — only right swipe triggers reply
        if (dx > 0) {
            // prevent parent panel drag / browser back swipe and keep scroll locked
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
            const clamped = Math.max(0, Math.min(dx, 80));
            setOffset(clamped);
        } else {
            // left swipe on bubble — don't show reply affordance, let it stay at 0
            setOffset(0);
        }
    };
    const onTouchEnd = (e) => {
        if (!startRef.current) return;
        const shouldReply = offset > 45 && lockRef.current === "h";
        if (shouldReply) {
            e.stopPropagation();
            onReply();
            if (navigator.vibrate) navigator.vibrate(20);
        }
        setOffset(0);
        startRef.current = null;
        lockRef.current = null;
    };
    const onTouchCancel = () => {
        setOffset(0);
        startRef.current = null;
        lockRef.current = null;
    };

    return (
        <div
            className="relative w-full touch-pan-y"
            style={{ touchAction: "pan-y" }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchCancel}
        >
            <div
                className="absolute inset-y-0 left-1 flex items-center"
                style={{
                    opacity: Math.min(offset / 45, 1),
                    transform: `scale(${Math.min(offset / 45, 1)})`,
                }}
            >
                <div className="flex size-7 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow">
                    <Reply className="h-3.5 w-3.5" />
                </div>
            </div>
            <div
                className="relative"
                style={{
                    transform: `translateX(${offset}px)`,
                    transition:
                        offset === 0
                            ? "transform 200ms cubic-bezier(0.22,1,0.36,1)"
                            : "none",
                }}
            >
                {children}
            </div>
        </div>
    );
}

// Online / Offline status label — uses the transitions-dev text-states-swap:
// the keyed span remounts on change so it blur-rises in (reduced-motion safe).
// When offline shows "active X min/hour/day ago" and ticks live every minute.
function StatusText({ online, lastActiveAt }) {
    const label = useLiveLastActive(lastActiveAt, online);
    return (
        <span key={label} className="t-text-swap">
            {label}
        </span>
    );
}

function EmptyState() {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-3 bg-[var(--bg-base)] px-6 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)]">
                <svg
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                >
                    <path
                        d="M4 5h16v11H9l-4 4V5z"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                    />
                </svg>
            </div>
            <p className="text-sm text-[var(--text-muted)]">
                Select a conversation to start chatting
            </p>
        </div>
    );
}

// Centered, non-interactive info chip for system notices (e.g. a member was
// removed from a group). Renders in the middle of the chat column.
function SystemNotice({ content }) {
    return (
        <div className="my-2 flex justify-center px-2">
            <span className="max-w-[90%] rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3.5 py-1.5 text-center text-[12px] text-[var(--text-muted)]">
                {content}
            </span>
        </div>
    );
}

function NewMessagesSeparator() {
    return (
        <div
            className="my-4 flex items-center gap-3"
            role="separator"
            aria-label="New messages"
        >
            <div className="h-px flex-1 bg-[var(--border)]" />
            <span className="rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-[var(--accent)]">
                New messages
            </span>
            <div className="h-px flex-1 bg-[var(--border)]" />
        </div>
    );
}

// Sticky day divider ("Today" / "Yesterday" / "Monday" / "Mar 4") — same
// visual language as the New-messages separator but neutral, so long
// histories scan without extra chrome.
function DateDivider({ ts }) {
    const label = formatDayDivider(ts);
    if (!label) return null;
    return (
        <div
            className="my-4 flex items-center gap-3"
            role="separator"
            aria-label={label}
        >
            <div className="h-px flex-1 bg-[var(--border)]" />
            <span className="rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1 text-[11px] font-medium tracking-wide text-[var(--text-muted)]">
                {label}
            </span>
            <div className="h-px flex-1 bg-[var(--border)]" />
        </div>
    );
}

// Compact "n min/h/d ago" for thread chips under root messages.
function timeAgoShort(ts) {
    if (!ts) return "";
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 45_000) return "now";
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d`;
    return "";
}

// Read-receipt state for the current user's own messages. Group chats don't show
// per-recipient receipts, so this is effectively DM-only.
function receiptState(message, userId, otherId) {
    if (message.senderId !== userId) return null;
    const read = otherId && message.readBy?.some((r) => r.userId === otherId);
    const delivered =
        otherId && message.deliveredTo?.some((id) => id === otherId);
    if (read) return "read";
    if (delivered) return "delivered";
    return "sent";
}

// Memoized message-list rows. ChatPanel holds ~40 state hooks, so unrelated
// re-renders (composer keystrokes, scroll-pill, typing indicator, presence)
// used to re-execute the per-message loop and re-render every MessageBubble.
// This memo boundary skips the whole list unless a row-affecting prop changed:
// `messages`, thread chips, unread separator, presence, edit/reaction/select
// state, or the viewport size. Handlers + per-conversation context travel in
// `ctx`, a ref object mutated in place each ChatPanel render, so its identity
// (and therefore the memo) stays stable while rows always call the freshest
// closures when they do re-render.
const MessageRows = React.memo(function MessageRows({
    messages,
    threadSummaries,
    onlineUsers,
    firstUnreadId,
    editingId,
    editText,
    reactionFor,
    replyingToId,
    selectMode,
    selectedIds,
    blockBusy,
    isMobile,
    ctx,
}) {
    const a = ctx.current;
    const { userId, otherId, isGroup, isChannel, isDm } = a;

    // Presence lookup from the onlineUsers prop (its identity change is what
    // triggers this list to re-render when peers come/go, refreshing rings).
    const isUserOnline = (uid) => {
        if (!uid) return false;
        const str = uid.toString();
        if (str === userId) return true;
        return onlineUsers.has(str);
    };

    // O(n) id → message index for reply lookups. The old inline
    // `messages.find(...)` inside the map was O(n²) once history grew.
    const byId = new Map();
    for (const msg of messages) byId.set(msg.id, msg);

    const senderName = (senderId) => {
        const s = a.membersById[senderId];
        return s ? participantName(s) : "Unknown";
    };
    const senderAvatar = (senderId) => {
        const s = a.membersById[senderId];
        return s
            ? { avatarStyle: s.avatarStyle, avatarUrl: s.avatarUrl }
            : { avatarStyle: null, avatarUrl: null };
    };

    return messages.map((m, i) => {
        const mine = m.senderId === userId;
        const isFirstUnread = m.id === firstUnreadId;
        const prevMsg = i > 0 ? messages[i - 1] : null;
        const showDateDivider =
            i === 0 || dayKey(m.createdAt) !== dayKey(prevMsg?.createdAt);
        if (m.type === "system") {
            return (
                <React.Fragment key={m.id}>
                    {showDateDivider && <DateDivider ts={m.createdAt} />}
                    {isFirstUnread && <NewMessagesSeparator />}
                    <SystemNotice content={m.content} />
                </React.Fragment>
            );
        }
        const receipt =
            m.status === "queued" ||
            m.status === "sending" ||
            m.status === "failed"
                ? null
                : receiptState(m, userId, otherId);
        const replySource = m.replyToMessageId
            ? byId.get(m.replyToMessageId)
            : null;
        const replyTo = replySource
            ? {
                  senderName: senderName(replySource.senderId),
                  content: replySource.isDeleted
                      ? "Message deleted"
                      : replySource.content || "",
              }
            : null;
        const prev = i > 0 ? messages[i - 1] : null;
        const next =
            i < messages.length - 1 ? messages[i + 1] : null;
        const grouped =
            !!prev &&
            prev.senderId === m.senderId &&
            !m.isDeleted &&
            !prev.isDeleted &&
            dayKey(m.createdAt) === dayKey(prev.createdAt) &&
            new Date(m.createdAt).getTime() -
                new Date(prev.createdAt).getTime() <=
                GROUP_WINDOW_MS;
        const groupLast =
            !next ||
            next.senderId !== m.senderId ||
            m.isDeleted ||
            next.isDeleted ||
            new Date(next.createdAt).getTime() -
                new Date(m.createdAt).getTime() >
                GROUP_WINDOW_MS;
        const showSender = (isGroup || isChannel) && !grouped && !mine;
        const sAvatar = senderAvatar(m.senderId);
        const senderLabel = senderName(m.senderId);
        const hasCopy =
            !m.isDeleted && Boolean(m.content || m.attachments?.length);
        const realMessage = Boolean(m.id && !m.tempId);
        const senderUsername = a.membersById[m.senderId]?.username || null;

        return (
            <React.Fragment key={m.id}>
                {showDateDivider && <DateDivider ts={m.createdAt} />}
                {isFirstUnread && <NewMessagesSeparator />}
                <div
                    id={`msg-${m.id}`}
                    className={`t-msg-in group flex w-full flex-col ${mine ? "items-end" : "items-start"} ${
                        i === 0
                            ? ""
                            : grouped
                              ? "mt-0.5"
                              : "mt-2"
                    }`}
                >
                    {showSender && (
                        <span
                            className={`mb-1 text-[12px] font-medium text-[var(--text-primary)] ${mine ? "self-end mr-1" : "self-start ml-8 sm:ml-9"}`}
                        >
                            {senderLabel}
                        </span>
                    )}
                    <div
                        className={`flex w-fit max-w-[78%] gap-2 ${mine ? "flex-row-reverse self-end" : "flex-row self-start"} items-end min-w-0 sm:max-w-[62%]`}
                    >
                        {(isGroup || isChannel) && !mine ? (
                            grouped ? (
                                <span
                                    className="hidden sm:block w-7 shrink-0"
                                    aria-hidden="true"
                                />
                            ) : (
                                <span className="hidden sm:flex shrink-0 mb-1">
                                    <Avatar
                                        name={senderLabel}
                                        avatarStyle={sAvatar.avatarStyle}
                                        url={sAvatar.avatarUrl}
                                        size="sm"
                                    />
                                </span>
                            )
                        ) : null}
                        {/* Mobile avatar — show only on first of group to keep clean */}
                        {(isGroup || isChannel) && !mine && !grouped ? (
                            <span className="flex sm:hidden shrink-0 mb-1">
                                <Avatar
                                    name={senderLabel}
                                    avatarStyle={sAvatar.avatarStyle}
                                    url={sAvatar.avatarUrl}
                                    size="sm"
                                />
                            </span>
                        ) : null}
                        <div className="flex min-w-0 flex-1 flex-col max-w-full">
                            <SwipeToReply
                                enabled={isMobile && !selectMode}
                                onReply={() => a.handleReply(m)}
                                className="w-full min-w-0"
                            >
                                <MessageBubble
                                    message={m}
                                    mine={mine}
                                    showMeta={groupLast}
                                    reactionOpen={reactionFor === m.id}
                                    isEditing={editingId === m.id}
                                    editText={editText}
                                    onEditTextChange={a.setEditText}
                                    onSaveEdit={() => a.saveEdit(m.id)}
                                    onCancelEdit={() => a.setEditingId(null)}
                                    onToggleReactionPicker={() =>
                                        a.toggleReactionPicker(m.id)
                                    }
                                    onReact={(emoji) => a.toggleReaction(m.id, emoji)}
                                    onEdit={() => {
                                        a.setEditingId(m.id);
                                        a.setEditText(m.content);
                                    }}
                                    onDelete={() => a.removeMessage(m.id)}
                                    onRetry={() => a.retry(m.tempId)}
                                    onReply={a.handleReply}
                                    onMarkUnread={() => a.handleMarkUnread(m.id)}
                                    isReplying={replyingToId === m.id}
                                    replyTo={replyTo}
                                    receipt={receipt}
                                    viewerId={a.viewerId}
                                    participants={a.participants}
                                    isUserOnline={isUserOnline}
                                    onOpenProfile={a.setProfileUsername}
                                    onCopy={
                                        hasCopy
                                            ? () => a.handleCopyMessage(m)
                                            : undefined
                                    }
                                    onSaveToggle={
                                        realMessage &&
                                        !m.isDeleted &&
                                        m.type !== "system"
                                            ? () => a.toggleSavedMessage(m)
                                            : undefined
                                    }
                                    onForward={
                                        realMessage
                                            ? () => a.openForwardPicker([m])
                                            : undefined
                                    }
                                    onPinToggle={
                                        realMessage
                                            ? () => a.handlePinToggle(m)
                                            : undefined
                                    }
                                    onSelectMode={
                                        realMessage
                                            ? () => a.enterSelectMode(m)
                                            : undefined
                                    }
                                    onShare={
                                        !m.isDeleted
                                            ? () => a.handleShareMessage(m)
                                            : undefined
                                    }
                                    onThread={
                                        realMessage &&
                                        !m.isDeleted &&
                                        m.type !== "system"
                                            ? () => a.openThread(m)
                                            : undefined
                                    }
                                    onProfile={
                                        !mine && senderUsername
                                            ? () => a.openProfileForSender(m)
                                            : undefined
                                    }
                                    onBlock={
                                        isDm && otherId && !mine
                                            ? a.isBlockedByMe
                                                ? () => a.handleUnblock()
                                                : () => a.handleBlock()
                                            : undefined
                                    }
                                    blockedByMe={a.isBlockedByMe}
                                    blockBusy={blockBusy}
                                    blockName={
                                        isDm && otherId ? a.otherName : ""
                                    }
                                    selectMode={selectMode}
                                    selected={selectedIds.has(m.id)}
                                    onSelectToggle={
                                        selectMode && realMessage && !m.isDeleted
                                            ? () => a.toggleSelected(m.id)
                                            : undefined
                                    }
                                    className="!max-w-full"
                                    contentClassName="max-w-full"
                                    isMobile={isMobile}
                                />
                            </SwipeToReply>
                        </div>
                    </div>
                    {/* Thread chip lives OUTSIDE the bubble's width-locked row so a
                      wide chip can never stretch/re-center the bubble. Aligned
                      to the bubble's edge: under the sender on the left for
                      others' messages, flush right under your own. */}
                    {!m.isDeleted && threadSummaries[m.id]?.replyCount > 0 && (
                        <button
                            type="button"
                            onClick={() => a.openThread(m)}
                            className={`kivo-focus mt-1 flex w-fit items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent)] transition-colors hover:bg-[var(--hover)] ${
                                mine ? "self-end" : "self-start ml-8 sm:ml-9"
                            }`}
                        >
                            <MessageSquareText
                                className="h-3 w-3 shrink-0"
                                aria-hidden
                            />
                            <span>
                                {threadSummaries[m.id].replyCount}{" "}
                                {threadSummaries[m.id].replyCount === 1
                                    ? "reply"
                                    : "replies"}
                            </span>
                            {threadSummaries[m.id].participants?.length > 0 && (
                                <span className="text-[var(--text-muted)]">
                                    ·{" "}
                                    {threadSummaries[
                                        m.id
                                    ].participants.join(", ")}
                                </span>
                            )}
                            {timeAgoShort(threadSummaries[m.id].lastReplyAt) && (
                                <span className="text-[var(--text-muted)]">
                                    ·{" "}
                                    {timeAgoShort(
                                        threadSummaries[m.id].lastReplyAt,
                                    )}
                                </span>
                            )}
                        </button>
                    )}
                </div>
            </React.Fragment>
        );
    });
});

export function ChatPanel({
    conversation,
    space,
    onBack,
    onOpenGroupSettings,
    onConversationUpdate,
    isOffline,
    highlightMessageId,
    onHighlightCleared,
}) {
    const { socket, reconnectNonce } = useSocket();
    const currentUser = getSession();
    const userId = currentUser?.id;

    const convId = conversation?.id || null;
    const isGroup = conversation?.type === "group";
    const isChannel = conversation?.type === "space_channel";
    const channelMeta =
        isChannel && space
            ? space.channels?.find((c) => c.id === conversation.channelId)
            : null;
    const isAnnouncement = channelMeta?.type === "announcement";
    const canPost =
        !isAnnouncement || (space && ["owner", "admin"].includes(space.myRole));
    const other =
        conversation && !isGroup && !isChannel
            ? otherParticipant(conversation, userId)
            : null;
    const otherId = other?.id || null;
    const otherName = participantName(other);
    const online = Array.isArray(conversation?.online)
        ? conversation.online.some(Boolean)
        : Boolean(conversation?.online);
    const isDm = Boolean(conversation && conversation.type === "dm");
    const isBlockedByMe = Boolean(conversation?.isBlockedByMe);
    const isBlockedByOther = Boolean(conversation?.isBlockedByOther);

    // Index group members by id so we can render sender names/avatars per message.
    const membersById = {};
    for (const p of conversation?.participants || []) {
        const id = p?.id || p?._id || p;
        if (id) membersById[id.toString()] = p;
    }
    const senderName = (senderId) => {
        const s = membersById[senderId];
        return s ? participantName(s) : "Unknown";
    };
    const senderAvatar = (senderId) => {
        const s = membersById[senderId];
        return s
            ? { avatarStyle: s.avatarStyle, avatarUrl: s.avatarUrl }
            : { avatarStyle: null, avatarUrl: null };
    };

    const [messages, setMessages] = useState([]);
    const messagesRef = useRef(messages);
    // Stable identity for the <MessageRows> ctx prop. Declared here (top of the
    // component) because the early `!conversation` return below must never
    // split hook calls between renders; only the `.current` mutation happens
    // later, just before the main return.
    const rowsCtx = useRef(null);
    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);
    // Durable outbox (offline sends). Re-renders this panel when the queue for
    // any conversation changes so queued bubbles appear/disappear live.
    const outboxSnapshot = useSyncExternalStore(
        subscribeOutbox,
        getOutboxSnapshot,
    );
    const [sendError, setSendError] = useState(null);
    const [nextCursor, setNextCursor] = useState(null);
    const [hasMore, setHasMore] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [text, setText] = useState("");

    // Composer drafts: unsent text is kept per conversation in localStorage
    // (survives switches + reloads) and cleared on send. The suppress flag
    // stops the save effect from filing the freshly-loaded draft under the
    // wrong conversation on the switch render.
    const draftSaveTimer = useRef(null);
    const suppressDraftSaveRef = useRef(false);
    // biome-ignore lint/correctness/useExhaustiveDependencies: restore-on-switch only; userId is stable per session.
    useEffect(() => {
        if (!convId) return;
        suppressDraftSaveRef.current = true;
        setText(loadDraft(draftsKey(userId), convId));
        setMentionOpen(false);
    }, [convId]);
    useEffect(() => {
        if (!convId || !userId) return undefined;
        if (suppressDraftSaveRef.current) {
            suppressDraftSaveRef.current = false;
            return undefined;
        }
        if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
        const snapshot = text;
        draftSaveTimer.current = setTimeout(() => {
            saveDraft(draftsKey(userId), convId, snapshot);
        }, 250);
        return () => {
            if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
        };
    }, [text, convId, userId]);

    // Message actions: pinned banner, forward picker, copy/share feedback, and
    // multi-select mode.
    const [pinnedMessages, setPinnedMessages] = useState([]);
    const [pinBusyId, setPinBusyId] = useState(null);
    const [lookOpen, setLookOpen] = useState(false);
    const [forwardOpen, setForwardOpen] = useState(false);
    const [forwardQueue, setForwardQueue] = useState([]);
    const [forwardConvs, setForwardConvs] = useState([]);
    const [forwardBusy, setForwardBusy] = useState(false);
    const [forwardError, setForwardError] = useState(null);
    const [notice, setNotice] = useState(null);
    const noticeTimerRef = useRef(null);
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(() => new Set());

    // Threads: the currently open thread's root message + per-root summaries so
    // chips under root bubbles show live reply counts/participants.
    const [threadRoot, setThreadRoot] = useState(null);
    const [threadSummaries, setThreadSummaries] = useState({});

    const refreshThreadSummaries = async () => {
        if (!convId) return;
        try {
            const data = await apiGet(
                `/api/v1/conversations/${convId}/threads`,
            );
            const map = {};
            for (const t of Array.isArray(data) ? data : []) {
                if (t?.root?.id && t.summary) map[t.root.id] = t.summary;
            }
            setThreadSummaries(map);
        } catch {
            /* keep previous summaries on transient failure */
        }
    };

    const openThread = (rootMsg) => setThreadRoot(rootMsg);
    const closeThread = () => {
        setThreadRoot(null);
        refreshThreadSummaries();
    };

    const showNotice = (text) => {
        setNotice(text);
        if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = setTimeout(() => setNotice(null), 2000);
    };

    // Reset per-conversation action state and load the pinned banner when the
    // open conversation changes.
    // biome-ignore lint/correctness/useExhaustiveDependencies: helper reads convId from closure; convId is the only real trigger.
    useEffect(() => {
        setSelectMode(false);
        setSelectedIds(new Set());
        setForwardOpen(false);
        setLookOpen(false);
        setPinnedMessages([]);
        setThreadRoot(null);
        setThreadSummaries({});
        setRecording(null);
        setNotice(null);
        if (!convId) return undefined;
        apiGet(`/api/v1/conversations/${convId}/pinned`)
            .then((data) => setPinnedMessages(Array.isArray(data) ? data : []))
            .catch(() => setPinnedMessages([]));
        refreshThreadSummaries();
        return undefined;
    }, [convId]);

    // Leave select mode with Escape.
    useEffect(() => {
        if (!selectMode) return undefined;
        const onKey = (e) => {
            if (e.key === "Escape") {
                setSelectMode(false);
                setSelectedIds(new Set());
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [selectMode]);

    // Close the thread panel with Escape (mirrors select-mode).
    // biome-ignore lint/correctness/useExhaustiveDependencies: helper is stable per conversation; threadRoot toggling is the trigger.
    useEffect(() => {
        if (!threadRoot) return undefined;
        const onKey = (e) => {
            if (e.key === "Escape") {
                setThreadRoot(null);
                refreshThreadSummaries();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [threadRoot]);

    // Keep queued/sending/failed outbox entries for the open conversation in the
    // message list (survives reloads) and mirror their status flips live.
    // biome-ignore lint/correctness/useExhaustiveDependencies: optimisticFromOutbox and userId are stable per session; including them would re-run the merge on every render.
    useEffect(() => {
        const pending = outboxSnapshot.filter(
            (e) =>
                e.conversationId === convId &&
                (e.status === "queued" ||
                    e.status === "sending" ||
                    e.status === "failed"),
        );
        if (!pending.length) return;
        setMessages((prev) => {
            const next = [...prev];
            let changed = false;
            for (const e of pending) {
                const i = next.findIndex((m) => m.tempId === e.tempId);
                if (i < 0) {
                    next.push(optimisticFromOutbox(e));
                    changed = true;
                } else if (next[i].status !== e.status) {
                    next[i] = { ...next[i], status: e.status };
                    changed = true;
                }
            }
            if (!changed) return prev;
            next.sort((a, b) => {
                const d =
                    new Date(a.createdAt).getTime() -
                    new Date(b.createdAt).getTime();
                return (
                    d ||
                    String(a.tempId || a.id).localeCompare(
                        String(b.tempId || b.id),
                    )
                );
            });
            return next;
        });
    }, [outboxSnapshot, convId]);

    // A flushed send came back from the server: swap the optimistic bubble for
    // the real message (and cache it), then drop the entry from the outbox.
    // biome-ignore lint/correctness/useExhaustiveDependencies: helpers are stable; outboxSnapshot + convId are the real triggers.
    useEffect(() => {
        const done = outboxSnapshot.filter(
            (e) =>
                e.conversationId === convId &&
                e.status === "sent" &&
                e.serverMessage &&
                e.serverMessage.id,
        );
        if (!done.length) return;
        setMessages((prev) => {
            const next = [...prev];
            for (const e of done) {
                const i = next.findIndex((m) => m.tempId === e.tempId);
                const real = { ...e.serverMessage, status: "sent" };
                if (i >= 0) {
                    next[i] = real;
                } else if (!next.some((m) => m.id === real.id)) {
                    next.push(real);
                }
            }
            return next;
        });
        for (const e of done) {
            if (e.serverMessage?.id) {
                mergeCachedMessage(convId, e.serverMessage).catch(() => {});
            }
            removeOutbox(e.tempId).catch(() => {});
        }
    }, [outboxSnapshot, convId]);

    // Build a bubble-shaped optimistic message for a queued/failed/sending
    // outbox entry — mirrors the optimistic object send() creates online.
    const optimisticFromOutbox = (e) => ({
        id: e.tempId,
        tempId: e.tempId,
        conversationId: e.conversationId,
        senderId: userId,
        content: e.content,
        replyToMessageId: e.replyToMessageId || null,
        attachments: [],
        reactions: [],
        deliveredTo: [],
        readBy: [],
        isEdited: false,
        isDeleted: false,
        createdAt: e.createdAt,
        status: e.status,
    });
    const [typing, setTyping] = useState(false);
    const [typerName, setTyperName] = useState(null);
    const [otherOnline, setOtherOnline] = useState(online);
    const [reactionFor, setReactionFor] = useState(null); // messageId with open picker
    const [editingId, setEditingId] = useState(null);
    const [editText, setEditText] = useState("");
    const [replyingTo, setReplyingTo] = useState(null); // message being replied to
    const [showEmoji, setShowEmoji] = useState(false);

    // Mention autocomplete state
    const [mentionOpen, setMentionOpen] = useState(false);
    const [mentionQuery, setMentionQuery] = useState("");
    const [mentionIndex, setMentionIndex] = useState(0);
    const [mentionPos, setMentionPos] = useState(null);
    const [showMore, setShowMore] = useState(false);
    const [blockBusy, setBlockBusy] = useState(false);
    const moreRef = useRef(null);

    // Mention → profile drawer (local, no route change)
    const [profileUsername, setProfileUsername] = useState(null);

    // Live online presence tracking set
    const [onlineUsers, setOnlineUsers] = useState(new Set());
    const [lastActiveByUser, setLastActiveByUser] = useState({});

    const textareaRef = useRef(null);
    const emojiBtnRef = useRef(null);
    const fileInputRef = useRef(null);

    // Voice-message recording (hold-to-record mic in the composer).
    const [recording, setRecording] = useState(null); // null | { startedAt, seconds, cancelling }
    const recorderRef = useRef(null);
    const recordingChunksRef = useRef([]);
    const pendingVoiceRef = useRef(null); // { cancelled, duration } consumed on recorder stop
    const recordingStartYRef = useRef(0);
    const micBtnRef = useRef(null);
    const {
        files: pendingFiles,
        addFiles,
        removeFile,
        clearAll,
        uploadAll,
        uploading: uploadBusy,
    } = useFileUpload();

    const isDesktop = useIsDesktop();
    const isMobile = !isDesktop;
    const reduce = useReducedMotion();

    useEffect(() => {
        if (!showMore) return;
        function onDoc(e) {
            if (moreRef.current && !moreRef.current.contains(e.target))
                setShowMore(false);
        }
        function onKey(e) {
            if (e.key === "Escape") setShowMore(false);
        }
        document.addEventListener("mousedown", onDoc);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDoc);
            document.removeEventListener("keydown", onKey);
        };
    }, [showMore]);

    const handleBlock = async () => {
        if (!otherId || blockBusy) return;
        setBlockBusy(true);
        try {
            await apiPost(`/api/v1/users/${otherId}/block`, {});
            setShowMore(false);
            if (onConversationUpdate && conversation) {
                onConversationUpdate({
                    ...conversation,
                    isBlockedByMe: true,
                    isBlockedByOther: false,
                });
            }
        } catch (err) {
            window.alert(err?.message || "Could not block user");
        } finally {
            setBlockBusy(false);
        }
    };
    const handleUnblock = async () => {
        if (!otherId || blockBusy) return;
        setBlockBusy(true);
        try {
            await apiPost(`/api/v1/users/${otherId}/unblock`, {});
            setShowMore(false);
            if (onConversationUpdate && conversation) {
                onConversationUpdate({
                    ...conversation,
                    isBlockedByMe: false,
                    isBlockedByOther: false,
                });
            }
        } catch (err) {
            window.alert(err?.message || "Could not unblock user");
        } finally {
            setBlockBusy(false);
        }
    };
    const handleRemoveFriend = async () => {
        if (!otherId || blockBusy) return;
        if (!window.confirm(`Remove ${otherName} from friends?`)) return;
        setBlockBusy(true);
        try {
            await apiDelete(`/api/v1/friends/${otherId}`);
            setShowMore(false);
        } catch (err) {
            window.alert(err?.message || "Could not remove friend");
        } finally {
            setBlockBusy(false);
        }
    };

    const scrollRef = useRef(null);
    const typingTimer = useRef(null);
    const bottomRef = useRef(null);

    // Sync presence set when conversation changes
    useEffect(() => {
        setOtherOnline(online);
        const nextSet = new Set();
        if (conversation?.participants) {
            if (!isGroup && !isChannel && otherId && online) {
                nextSet.add(otherId.toString());
            }
            if (
                Array.isArray(conversation.online) &&
                Array.isArray(conversation.otherParticipantIds)
            ) {
                conversation.otherParticipantIds.forEach((id, idx) => {
                    if (conversation.online[idx]) nextSet.add(id.toString());
                });
            }
        }
        setOnlineUsers(nextSet);
        // seed lastActive from participants payload
        const seeded = {};
        for (const p of conversation?.participants || []) {
            const pid = (p.id || p._id || p)?.toString?.();
            if (pid && p.lastActiveAt) seeded[pid] = p.lastActiveAt;
        }
        if (Object.keys(seeded).length) {
            setLastActiveByUser((prev) => ({ ...prev, ...seeded }));
        }
    }, [conversation, online, otherId, isGroup, isChannel]);

    useEffect(() => {
        if (!socket) return;
        const onOnline = (p) => {
            if (p?.userId) {
                setOnlineUsers((prev) =>
                    new Set(prev).add(p.userId.toString()),
                );
                if (p.lastActiveAt) {
                    setLastActiveByUser((prev) => ({
                        ...prev,
                        [p.userId.toString()]: p.lastActiveAt,
                    }));
                }
            }
        };
        const onOffline = (p) => {
            if (p?.userId) {
                setOnlineUsers((prev) => {
                    const next = new Set(prev);
                    next.delete(p.userId.toString());
                    return next;
                });
                if (p.lastActiveAt) {
                    setLastActiveByUser((prev) => ({
                        ...prev,
                        [p.userId.toString()]: p.lastActiveAt,
                    }));
                } else {
                    setLastActiveByUser((prev) => ({
                        ...prev,
                        [p.userId.toString()]: new Date().toISOString(),
                    }));
                }
            }
        };
        socket.on("presence:online", onOnline);
        socket.on("presence:offline", onOffline);
        return () => {
            socket.off("presence:online", onOnline);
            socket.off("presence:offline", onOffline);
        };
    }, [socket]);

    const firstUnreadId = useMemo(() => {
        if (!userId) return null;
        const found = messages.find(
            (m) =>
                !m.isDeleted &&
                m.type !== "system" &&
                m.senderId !== userId &&
                !m.readBy?.some(
                    (r) => (r.userId || r)?.toString() === userId.toString(),
                ),
        );
        return found ? found.id : null;
    }, [messages, userId]);

    const getFilteredParticipants = (queryStr) => {
        return (conversation?.participants || []).filter((p) => {
            if (!p) return false;
            const pid = (p.id || p._id || p)?.toString?.();
            if (pid === userId) return false;
            const u = p.username || "";
            const d = p.displayName || "";
            const q = queryStr.toLowerCase();
            return (
                u.toLowerCase().startsWith(q) || d.toLowerCase().startsWith(q)
            );
        });
    };

    const checkMentionTrigger = (val, cursorPosition) => {
        const pos =
            cursorPosition ?? textareaRef.current?.selectionStart ?? val.length;
        const textBeforeCaret = val.slice(0, pos);
        const lastAt = textBeforeCaret.lastIndexOf("@");

        if (lastAt !== -1) {
            const isStartOrSpace = lastAt === 0 || /\s/.test(val[lastAt - 1]);
            const sub = val.slice(lastAt + 1, pos);
            if (isStartOrSpace && !/\s/.test(sub)) {
                const matching = getFilteredParticipants(sub);

                if (matching.length > 0) {
                    setMentionOpen(true);
                    setMentionQuery(sub);
                    setMentionPos(lastAt);
                    setMentionIndex(0);
                    return;
                }
            }
        }
        setMentionOpen(false);
    };

    const handleSelectMention = (p) => {
        if (!p || mentionPos === null) return;
        const handle = p.username || p.displayName;
        if (!handle) return;

        const pos = textareaRef.current?.selectionStart ?? text.length;
        const before = text.slice(0, mentionPos);
        const after = text.slice(pos);
        const inserted = `@${handle} `;
        const newText = before + inserted + after;
        const newCursorPos = mentionPos + inserted.length;

        setText(newText);
        setMentionOpen(false);

        requestAnimationFrame(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(
                    newCursorPos,
                    newCursorPos,
                );
            }
        });
    };

    // Jump-to-message session bookkeeping: once an anchor page is loaded, ending
    // the highlight (2s flash) must NOT re-run the normal fetch — that would
    // replace the anchored page with the newest 50 and scroll away ("the chat
    // reloads"). We only refetch normally when the conversation or the jump
    // target actually changes.
    const wasAnchorSessionRef = useRef(false);
    const anchorConvRef = useRef(null);
    // Keep the latest clear callback in a ref so the highlight effect doesn't
    // re-run on every parent render (it would restart the flash timer + scroll).
    const clearHighlightRef = useRef(onHighlightCleared);
    useEffect(() => {
        clearHighlightRef.current = onHighlightCleared;
    }, [onHighlightCleared]);

    // Load message history when the conversation changes — stale-while-revalidate.
    // Render cached messages instantly, then silently revalidate via REST.
    // If highlightMessageId is set, use the anchor-based fetch (around=) instead.
    useEffect(() => {
        if (!convId) {
            setMessages([]);
            setNextCursor(null);
            setHasMore(false);
            setReplyingTo(null);
            return undefined;
        }
        let active = true;
        setReplyingTo(null);

        // A highlight session just ended (flash finished): keep the anchored page
        // exactly as it is — no refetch and (see the auto-scroll effect) no yank to
        // the bottom. If the conversation changed mid-session, drop the stale flag
        // so the new conversation loads normally.
        if (!highlightMessageId && wasAnchorSessionRef.current) {
            if (anchorConvRef.current === convId) return undefined;
            wasAnchorSessionRef.current = false;
            anchorConvRef.current = null;
        }
        wasAnchorSessionRef.current = Boolean(highlightMessageId);
        if (highlightMessageId) anchorConvRef.current = convId;

        const useAnchor = highlightMessageId && convId;

        if (useAnchor) {
            // Anchor-based fetch: jump to the specific message
            setLoadingHistory(true);
            apiGet(
                `/api/v1/conversations/${convId}/messages?limit=50&around=${highlightMessageId}`,
            )
                .then((data) => {
                    if (!active) return;
                    const msgs = data?.messages || [];
                    setMessages(msgs);
                    // Anchor-based fetch doesn't paginate from newest end
                    setNextCursor(null);
                    setHasMore(false);
                })
                .catch(() => {
                    if (active) setMessages([]);
                })
                .finally(() => {
                    if (active) setLoadingHistory(false);
                });
        } else {
            // Normal fetch: stale-while-revalidate
            // 1) Hydrate from IndexedDB cache immediately
            getCachedMessages(convId)
                .then((cached) => {
                    if (!active || !cached) return;
                    if (
                        Array.isArray(cached.messages) &&
                        cached.messages.length
                    ) {
                        setMessages(cached.messages);
                        if (cached.nextCursor) {
                            setNextCursor(cached.nextCursor);
                            setHasMore(true);
                        }
                    }
                })
                .catch(() => {});

            // 2) Revalidate from REST in the background
            setLoadingHistory(true);
            apiGet(`/api/v1/conversations/${convId}/messages?limit=50`)
                .then((data) => {
                    if (!active) return;
                    const msgs = data?.messages || [];
                    setMessages(msgs);
                    setNextCursor(data?.nextCursor || null);
                    setHasMore(Boolean(data?.nextCursor));
                    setCachedMessages(convId, msgs, {
                        nextCursor: data?.nextCursor || null,
                        hasMore: Boolean(data?.nextCursor),
                    }).catch(() => {});
                })
                .catch(() => {
                    // Network failed — keep whatever was in cache (or empty)
                })
                .finally(() => {
                    if (active) setLoadingHistory(false);
                });
        }

        return () => {
            active = false;
        };
    }, [convId, highlightMessageId]);

    // Jump-to-latest pill: appears when the user scrolls up away from the
    // live edge. Shows the unread count when there is one; one tap returns
    // to the bottom.
    const [showJumpPill, setShowJumpPill] = useState(false);
    const NEAR_BOTTOM_PX = 120;
    const PILL_SHOW_PX = 200;

    const distanceFromBottom = () => {
        const el = scrollRef.current;
        if (!el) return 0;
        return el.scrollHeight - el.scrollTop - el.clientHeight;
    };
    const isNearBottom = () => distanceFromBottom() < NEAR_BOTTOM_PX;

    const scrollToBottom = (smooth = true) => {
        const el = scrollRef.current;
        if (!el) return;
        setShowJumpPill(false);
        el.scrollTo({
            top: el.scrollHeight,
            behavior: smooth && !reduce ? "smooth" : "auto",
        });
    };

    // Unread others' messages — drives the pill's "N new" label.
    const unreadCount = useMemo(() => {
        if (!userId) return 0;
        let n = 0;
        for (const m of messages) {
            if (
                !m.isDeleted &&
                m.type !== "system" &&
                m.senderId !== userId &&
                !m.readBy?.some(
                    (r) => (r.userId || r)?.toString() === userId.toString(),
                )
            ) {
                n += 1;
            }
        }
        return n;
    }, [messages, userId]);

    // Keep pinned to the bottom on new messages / typing changes — but only
    // when the user is already at the live edge (or just sent something
    // themselves). Reading history no longer gets yanked to the bottom; the
    // pill offers the way back instead.
    // Skip auto-scroll when we have a highlight target (jump-to-message), and
    // once that jump session ends, consume the flag WITHOUT scrolling — the page
    // is already anchored where the user wants to be.
    const prevConvForPinRef = useRef(null);
    useEffect(() => {
        if (highlightMessageId) return;
        if (wasAnchorSessionRef.current && anchorConvRef.current === convId) {
            wasAnchorSessionRef.current = false;
            anchorConvRef.current = null;
            return;
        }
        wasAnchorSessionRef.current = false;
        void typing;
        const convChanged = prevConvForPinRef.current !== convId;
        prevConvForPinRef.current = convId;
        if (convChanged) {
            setShowJumpPill(false);
            bottomRef.current?.scrollIntoView({ block: "end" });
            return;
        }
        const last = messages[messages.length - 1];
        const ownLatest = last && last.senderId === userId;
        if (isNearBottom() || ownLatest) {
            bottomRef.current?.scrollIntoView({ block: "end" });
        } else {
            setShowJumpPill(true);
        }
    }, [messages.length, typing, highlightMessageId, convId]);

    // Jump-to-message highlight: when highlightMessageId is set, scroll to it
    // and apply a brief background flash once the messages are loaded.
    // Only activate if the highlighted message belongs to this conversation.
    useEffect(() => {
        if (!highlightMessageId || messages.length === 0) return;
        // Guard: only highlight if the message is in the current conversation
        const inConv = messages.some((m) => m.id === highlightMessageId);
        if (!inConv) return;
        // Wait a tick for the DOM to render the target message
        const raf = requestAnimationFrame(() => {
            const el = document.getElementById(`msg-${highlightMessageId}`);
            if (el) {
                el.scrollIntoView({ block: "center", behavior: "smooth" });
                // Apply highlight
                el.style.transition = "background-color 0.6s ease";
                el.style.backgroundColor = "rgba(75, 169, 225, 0.15)";
                // Remove after 2s
                const timer = setTimeout(() => {
                    el.style.backgroundColor = "transparent";
                    clearHighlightRef.current?.();
                }, 2000);
                return () => clearTimeout(timer);
            }
            clearHighlightRef.current?.();
        });
        return () => cancelAnimationFrame(raf);
    }, [highlightMessageId, messages]);

    // Load older messages (prepend) when the user scrolls to the top.
    const loadOlder = () => {
        if (!hasMore || !nextCursor || loadingHistory) return;
        setLoadingHistory(true);
        apiGet(
            `/api/v1/conversations/${convId}/messages?limit=50&cursor=${nextCursor}`,
        )
            .then((data) => {
                const older = data?.messages || [];
                setMessages((prev) => [...older, ...prev]);
                setNextCursor(data?.nextCursor || null);
                setHasMore(Boolean(data?.nextCursor));
            })
            .catch(() => {})
            .finally(() => setLoadingHistory(false));
    };

    // Reconnect catch-up: fetch messages newer than the newest known message
    // via the `after` cursor and merge through the same reconcile path. Once
    // per successful reconnect (reconnectNonce), not per retry. Fails silently.
    useEffect(() => {
        if (reconnectNonce === 0) return;
        if (!convId) return;
        const msgs = messagesRef.current || [];
        // Find newest real message id (skip optimistic tempIds)
        const lastReal = [...msgs]
            .reverse()
            .find((m) => m?.id && !String(m.id).startsWith("t_"));
        const afterId = lastReal?.id;
        if (!afterId) return;
        apiGet(
            `/api/v1/conversations/${convId}/messages?after=${afterId}&limit=100`,
        )
            .then((data) => {
                const incoming = data?.messages || [];
                if (!incoming.length) return;
                setMessages((prev) => {
                    const next = [...prev];
                    for (const msg of incoming) {
                        const byId = next.findIndex((m) => m.id === msg.id);
                        if (byId >= 0) {
                            next[byId] = {
                                ...next[byId],
                                ...msg,
                                status: "sent",
                            };
                            continue;
                        }
                        if (msg.senderId === userId) {
                            const t = next.findIndex(
                                (m) =>
                                    m.tempId &&
                                    m.senderId === userId &&
                                    m.content === msg.content &&
                                    (m.status === "sending" ||
                                        m.status === "failed" ||
                                        m.status === "queued"),
                            );
                            if (t >= 0) {
                                next[t] = { ...msg, status: "sent" };
                                continue;
                            }
                        }
                        next.push({ ...msg, status: "sent" });
                    }
                    // Keep chronological order; incoming is already ascending, but sort defensively
                    next.sort(
                        (a, b) =>
                            new Date(a.createdAt).getTime() -
                            new Date(b.createdAt).getTime(),
                    );
                    return next;
                });
                // Persist gap-filled messages to IDB cache via same pipeline as live events
                for (const m of incoming) {
                    if (m?.id) mergeCachedMessage(convId, m).catch(() => {});
                }
            })
            .catch(() => {});
    }, [reconnectNonce, convId, userId]);

    // Realtime event wiring for this conversation.
    // biome-ignore lint/correctness/useExhaustiveDependencies: chat-panel rebuilds sender/name helpers per conversation; the effect re-subscribes on convId/userId.
    useEffect(() => {
        if (!socket || !convId) return undefined;

        const reconcile = (msg) => {
            setMessages((prev) => {
                const byId = prev.findIndex((m) => m.id === msg.id);
                if (byId >= 0) {
                    const copy = [...prev];
                    copy[byId] = { ...copy[byId], ...msg, status: "sent" };
                    return copy;
                }
                // Own message echoed back: replace a matching optimistic temp by content.
                if (msg.senderId === userId) {
                    const t = prev.findIndex(
                        (m) =>
                            m.tempId &&
                            m.senderId === userId &&
                            m.content === msg.content &&
                            (m.status === "sending" ||
                                m.status === "failed" ||
                                m.status === "queued"),
                    );
                    if (t >= 0) {
                        const copy = [...prev];
                        copy[t] = { ...msg, status: "sent" };
                        return copy;
                    }
                }
                return [...prev, { ...msg, status: "sent" }];
            });
        };

        const onNew = (msg) => {
            if (msg.conversationId !== convId) return;
            // Thread replies never enter the main timeline — refresh the chips under
            // root bubbles instead (the open thread panel subscribes separately).
            if (msg.threadId) {
                refreshThreadSummaries();
                return;
            }
            reconcile(msg);
            // Persist the new message into IDB cache
            if (msg?.id) mergeCachedMessage(convId, msg).catch(() => {});
            socket.emit("message:delivered", { messageId: msg.id });
            if (msg.senderId !== userId) {
                apiPatch(`/api/v1/conversations/${convId}/read`, {
                    upToMessageId: msg.id,
                }).catch(() => {});
            }
        };
        const onReaction = (payload) => {
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === payload.messageId
                        ? { ...m, reactions: payload.reactions }
                        : m,
                ),
            );
        };
        const onRead = (payload) => {
            if (payload.conversationId !== convId || payload.userId === userId)
                return;
            const readerId = String(payload.userId);
            const readAt = payload.readAt
                ? new Date(payload.readAt)
                : new Date();
            // The server marks everything up to the anchor read (no anchor =
            // whole conversation), so only stamp messages at/before the cutoff.
            // Without this, a member who read a few messages would appear to
            // have read newer ones they never saw.
            const cutoff = payload.upToCreatedAt
                ? new Date(payload.upToCreatedAt).getTime()
                : Infinity;
            setMessages((prev) =>
                prev.map((m) => {
                    if (m.senderId !== userId) return m;
                    if (
                        m.readBy?.some(
                            (r) =>
                                String(r.userId || r) === readerId,
                        )
                    )
                        return m;
                    if (new Date(m.createdAt).getTime() > cutoff) return m;
                    return {
                        ...m,
                        readBy: [...(m.readBy || []), { userId: payload.userId, readAt }],
                    };
                }),
            );
        };
        const onDelivery = (payload) => {
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === payload.messageId
                        ? { ...m, deliveredTo: payload.deliveredTo }
                        : m,
                ),
            );
        };
        const onUnread = (payload) => {
            if (payload.conversationId !== convId) return;
            // payload contains anchorMessageId and the user who marked unread
            // For current user, make anchor and newer messages unread (remove readBy)
            if (payload.userId !== userId) return;
            const anchorId = payload.anchorMessageId;
            if (!anchorId) return;
            setMessages((prev) => {
                const anchor = prev.find((m) => m.id === anchorId);
                const anchorTime = anchor
                    ? new Date(anchor.createdAt).getTime()
                    : 0;
                return prev.map((m) => {
                    if (
                        m.senderId === userId ||
                        m.isDeleted ||
                        m.type === "system"
                    )
                        return m;
                    const t = new Date(m.createdAt).getTime();
                    if (t >= anchorTime) {
                        return {
                            ...m,
                            readBy: (m.readBy || []).filter(
                                (r) =>
                                    (r.userId || r).toString() !==
                                    userId.toString(),
                            ),
                        };
                    }
                    return m;
                });
            });
        };
        const onTypingStart = (p) => {
            if (p.conversationId === convId && p.userId !== userId) {
                setTyping(true);
                setTyperName(
                    isGroup || isChannel ? senderName(p.userId) : otherName,
                );
            }
        };
        const onTypingStop = (p) => {
            if (p.conversationId === convId && p.userId !== userId)
                setTyping(false);
        };
        const onOnline = (p) => {
            if (p?.userId === otherId) {
                setOtherOnline(true);
                if (p.lastActiveAt)
                    setLastActiveByUser((prev) => ({
                        ...prev,
                        [otherId]: p.lastActiveAt,
                    }));
            }
        };
        const onOffline = (p) => {
            if (p?.userId === otherId) {
                setOtherOnline(false);
                const ts = p.lastActiveAt || new Date().toISOString();
                setLastActiveByUser((prev) => ({ ...prev, [otherId]: ts }));
            }
        };

        // Wrap reconcile so it also persists the updated message to IDB cache.
        // Thread replies never touch the main timeline or its cache — they just
        // refresh the chips under root bubbles (the open panel subscribes itself).
        const reconcileAndCache = (msg) => {
            if (msg?.threadId) {
                refreshThreadSummaries();
                return;
            }
            reconcile(msg);
            if (convId && msg?.id) {
                mergeCachedMessage(convId, msg).catch(() => {});
            }
        };

        socket.on("message:new", onNew);
        socket.on("message:edited", reconcileAndCache);
        socket.on("message:deleted", reconcileAndCache);
        socket.on("message:reaction", onReaction);
        socket.on("message:read", onRead);
        socket.on("message:delivery-updated", onDelivery);
        socket.on("message:unread", onUnread);
        socket.on("typing:start", onTypingStart);
        socket.on("typing:stop", onTypingStop);
        socket.on("presence:online", onOnline);
        socket.on("presence:offline", onOffline);

        return () => {
            socket.off("message:new", onNew);
            socket.off("message:edited", reconcileAndCache);
            socket.off("message:deleted", reconcileAndCache);
            socket.off("message:reaction", onReaction);
            socket.off("message:read", onRead);
            socket.off("message:delivery-updated", onDelivery);
            socket.off("message:unread", onUnread);
            socket.off("typing:start", onTypingStart);
            socket.off("typing:stop", onTypingStop);
            socket.off("presence:online", onOnline);
            socket.off("presence:offline", onOffline);
        };
    }, [socket, convId, userId, otherId, isGroup]);

    // Live pin updates: keep the pinned banner and the message list in sync for
    // every member (pin/unpin here or in another device/tab).
    useEffect(() => {
        if (!socket) return undefined;
        const onPinUpdated = (payload) => {
            if (
                !payload ||
                payload.conversationId !== convId ||
                !payload.message
            ) {
                return;
            }
            const msg = payload.message;
            setMessages((prev) =>
                prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m)),
            );
            setPinnedMessages((prev) => {
                const rest = prev.filter((p) => p.id !== msg.id);
                if (msg.pinnedAt) return [msg, ...rest].slice(0, 10);
                return rest;
            });
        };
        const onDeleted = (payload) => {
            if (!payload || payload.conversationId !== convId) return;
            setPinnedMessages((prev) =>
                prev.filter((p) => p.id !== payload.id),
            );
        };
        socket.on("message:pin-updated", onPinUpdated);
        socket.on("message:deleted", onDeleted);
        return () => {
            socket.off("message:pin-updated", onPinUpdated);
            socket.off("message:deleted", onDeleted);
        };
    }, [socket, convId]);

    // Stop emitting "typing" when leaving the conversation.
    useEffect(() => {
        return () => {
            if (typingTimer.current) clearTimeout(typingTimer.current);
            if (socket && convId)
                socket.emit("typing:stop", { conversationId: convId });
        };
    }, [socket, convId]);

    // Cancel reply mode on Escape.
    useEffect(() => {
        if (!replyingTo) return undefined;
        const onKey = (e) => {
            if (e.key === "Escape") cancelReply();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [replyingTo]);

    const emitTyping = () => {
        if (!socket || !convId) return;
        socket.emit("typing:start", { conversationId: convId });
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => {
            socket.emit("typing:stop", { conversationId: convId });
        }, TYPING_IDLE_MS);
    };

    // Insert an emoji at the caret position in the composer (falls back to
    // appending at the end when the textarea isn't focused).
    const insertEmoji = (emoji) => {
        const el = textareaRef.current;
        const start = el ? el.selectionStart : text.length;
        const end = el ? el.selectionEnd : text.length;
        const next = text.slice(0, start) + emoji + text.slice(end);
        setText(next);
        requestAnimationFrame(() => {
            if (!el) return;
            const pos = start + emoji.length;
            el.focus();
            el.setSelectionRange(pos, pos);
        });
    };

    const handleReply = (m) => {
        if (!m || m.isDeleted) return;
        setReplyingTo(m);
        requestAnimationFrame(() => textareaRef.current?.focus());
    };
    const cancelReply = () => {
        setReplyingTo(null);
    };

    const insertOptimistic = (optimistic) => {
        setMessages((prev) => {
            if (prev.some((m) => m.tempId === optimistic.tempId)) return prev;
            const next = [...prev, optimistic];
            next.sort((a, b) => {
                const d =
                    new Date(a.createdAt).getTime() -
                    new Date(b.createdAt).getTime();
                return (
                    d ||
                    String(a.tempId || a.id).localeCompare(
                        String(b.tempId || b.id),
                    )
                );
            });
            return next;
        });
    };

    const send = async () => {
        const content = text.trim();
        const hasFiles = pendingFiles.some((f) => f.status === "pending");
        if ((!content && !hasFiles) || !convId) return;
        setSendError(null);
        const tempId = `t_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const replyToId = replyingTo?.id ?? null;

        // Attachments need a live upload path — never queue files.
        if (isOffline && hasFiles) {
            setSendError(
                "Attachments need a connection. Text messages will be queued while you're offline.",
            );
            return;
        }

        setReplyingTo(null);

        // Offline text send → durable outbox + optimistic "queued" bubble. The
        // OutboxFlusher pushes it once a connection comes back.
        if (isOffline && content && !hasFiles) {
            const now = new Date().toISOString();
            enqueueOutbox({
                tempId,
                conversationId: convId,
                content,
                replyToMessageId: replyToId,
                createdAt: now,
                status: "queued",
            }).catch(() => {});
            insertOptimistic({
                id: tempId,
                tempId,
                conversationId: convId,
                senderId: userId,
                content,
                replyToMessageId: replyToId,
                attachments: [],
                reactions: [],
                deliveredTo: [],
                readBy: [],
                isEdited: false,
                isDeleted: false,
                createdAt: now,
                status: "queued",
            });
            setText("");
            clearDraft(draftsKey(userId), convId);
            clearAll();
            setMentionOpen(false);
            if (typingTimer.current) clearTimeout(typingTimer.current);
            if (socket) socket.emit("typing:stop", { conversationId: convId });
            return;
        }

        // Online path: upload files first if any are pending
        let attachments = [];
        if (hasFiles) {
            try {
                attachments = await uploadAll(convId);
            } catch {
                // Upload errors are already shown per-file
            }
            // If upload failed and there's no text, don't send an empty message
            if (attachments.length === 0 && !content) {
                return;
            }
        }

        const optimistic = {
            id: tempId,
            tempId,
            conversationId: convId,
            senderId: userId,
            content,
            attachments,
            reactions: [],
            deliveredTo: [],
            readBy: [],
            isEdited: false,
            isDeleted: false,
            createdAt: new Date().toISOString(),
            status: "sending",
        };
        insertOptimistic(optimistic);
        setText("");
        clearDraft(draftsKey(userId), convId);
        clearAll();
        setMentionOpen(false);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        if (socket) socket.emit("typing:stop", { conversationId: convId });
        try {
            const msg = await apiPost(
                `/api/v1/conversations/${convId}/messages`,
                {
                    content: content || undefined,
                    ...(replyToId && { replyToMessageId: replyToId }),
                    ...(attachments.length > 0 && { attachments }),
                },
            );
            setMessages((prev) =>
                prev.map((m) =>
                    m.tempId === tempId ? { ...msg, status: "sent" } : m,
                ),
            );
            removeOutbox(tempId).catch(() => {});
        } catch {
            setMessages((prev) =>
                prev.map((m) =>
                    m.tempId === tempId ? { ...m, status: "failed" } : m,
                ),
            );
            // Persist the failure so it survives a reload and can be retried.
            enqueueOutbox({
                tempId,
                conversationId: convId,
                content,
                replyToMessageId: replyToId,
                createdAt: optimistic.createdAt,
                status: "failed",
            }).catch(() => {});
        }
    };

    const retry = async (tempId) => {
        const m = messages.find((x) => x.tempId === tempId);
        if (!m || !convId) return;
        setSendError(null);
        setMessages((prev) =>
            prev.map((x) =>
                x.tempId === tempId ? { ...x, status: "sending" } : x,
            ),
        );
        setOutboxStatus(tempId, "sending").catch(() => {});
        try {
            const msg = await apiPost(
                `/api/v1/conversations/${convId}/messages`,
                {
                    content: m.content,
                    ...(m.replyToMessageId && {
                        replyToMessageId: m.replyToMessageId,
                    }),
                },
            );
            setMessages((prev) =>
                prev.map((x) =>
                    x.tempId === tempId ? { ...msg, status: "sent" } : x,
                ),
            );
            if (msg?.id) mergeCachedMessage(convId, msg).catch(() => {});
            removeOutbox(tempId).catch(() => {});
        } catch {
            setMessages((prev) =>
                prev.map((x) =>
                    x.tempId === tempId ? { ...x, status: "failed" } : x,
                ),
            );
            setOutboxStatus(tempId, "failed").catch(() => {});
            // Persist even failures that predate the queue (e.g. an old in-memory
            // failed bubble) so a reload can still offer the retry.
            if (!getPendingOutbox().some((x) => x.tempId === tempId)) {
                enqueueOutbox({
                    tempId,
                    conversationId: convId,
                    content: m.content,
                    replyToMessageId: m.replyToMessageId || null,
                    createdAt: m.createdAt || new Date().toISOString(),
                    status: "failed",
                }).catch(() => {});
            }
        }
    };

    // ─── Voice messages (hold-to-record) ─────────────────────────────

    const pickRecorderMime = () => {
        if (typeof MediaRecorder === "undefined") return "";
        const candidates = [
            "audio/webm;codecs=opus",
            "audio/webm",
            "audio/mp4",
            "audio/ogg",
        ];
        for (const m of candidates) {
            try {
                if (MediaRecorder.isTypeSupported(m)) return m;
            } catch {
                /* older browsers throw on isTypeSupported */
            }
        }
        return "";
    };

    const formatRecordTime = (s) =>
        `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

    const startRecording = async (e) => {
        if (e?.preventDefault) e.preventDefault();
        if (recording || uploadBusy || !convId) return;
        if (isOffline) {
            setSendError(
                "Voice messages need a connection. Text messages will be queued while you're offline.",
            );
            return;
        }
        if (
            typeof MediaRecorder === "undefined" ||
            !navigator.mediaDevices?.getUserMedia
        ) {
            setSendError("Voice recording isn't supported in this browser.");
            return;
        }
        setSendError(null);
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
            setSendError(
                "Microphone access was denied. Allow the mic in your browser and try again.",
            );
            return;
        }
        const mime = pickRecorderMime();
        let recorder;
        try {
            recorder = mime
                ? new MediaRecorder(stream, { mimeType: mime })
                : new MediaRecorder(stream);
        } catch {
            recorder = new MediaRecorder(stream);
        }
        recordingChunksRef.current = [];
        recorder.ondataavailable = (ev) => {
            if (ev.data && ev.data.size > 0)
                recordingChunksRef.current.push(ev.data);
        };
        // The final chunk arrives after stop(), so assemble the blob on stop.
        recorder.onstop = () => {
            const pending = pendingVoiceRef.current;
            pendingVoiceRef.current = null;
            const chunks = recordingChunksRef.current;
            recordingChunksRef.current = [];
            try {
                recorder.stream?.getTracks?.().forEach((t) => {
                    t.stop();
                });
            } catch {
                /* stream may already be dead */
            }
            if (!pending || pending.cancelled || chunks.length === 0) return;
            const blob = new Blob(chunks, {
                type: recorder.mimeType || "audio/webm",
            });
            sendVoiceMessage(blob, pending.duration);
        };
        recorder.start();
        recorderRef.current = recorder;
        recordingStartYRef.current = e?.clientY ?? 0;
        try {
            micBtnRef.current?.setPointerCapture?.(e.pointerId);
        } catch {
            /* pointer capture can throw on edge cases */
        }
        setRecording({ startedAt: Date.now(), seconds: 0, cancelling: false });
    };

    const finishRecording = () => {
        const recorder = recorderRef.current;
        if (!recorder || recorder.state === "inactive") return;
        pendingVoiceRef.current = {
            cancelled: Boolean(recording?.cancelling),
            duration: recording?.seconds ?? 0,
        };
        setRecording(null);
        try {
            recorder.stop();
        } catch {
            /* already stopped */
        }
        recorderRef.current = null;
    };

    const cancelRecording = () => {
        const recorder = recorderRef.current;
        if (!recorder || recorder.state === "inactive") return;
        pendingVoiceRef.current = { cancelled: true, duration: 0 };
        setRecording(null);
        try {
            recorder.stop();
        } catch {
            /* already stopped */
        }
        recorderRef.current = null;
    };

    const moveDuringRecording = (e) => {
        if (!recording) return;
        const dy = (e.clientY ?? 0) - recordingStartYRef.current;
        const cancelling = dy < -70;
        if (cancelling !== recording.cancelling) {
            setRecording((prev) => (prev ? { ...prev, cancelling } : prev));
        }
    };

    const sendVoiceMessage = async (blob, duration) => {
        if (!convId) return;
        setSendError(null);
        const tempId = `t_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        let uploaded;
        try {
            // Normalize the container MIME (strip any ;codecs= suffix) so the server
            // allow-list matches, and keep a recognizable extension.
            const baseType = (blob.type || "audio/webm").split(";")[0].trim();
            const ext = baseType.includes("mp4")
                ? "m4a"
                : baseType.includes("ogg")
                  ? "ogg"
                  : "webm";
            const file = new File([blob], `Voice message.${ext}`, {
                type: baseType,
            });
            uploaded = await uploadSingleFileObject(file, convId);
            if (!uploaded) throw new Error("Upload failed");
        } catch (err) {
            setSendError(err?.message || "Could not upload the voice message.");
            return;
        }
        const optimistic = {
            id: tempId,
            tempId,
            conversationId: convId,
            senderId: userId,
            content: "",
            attachments: [uploaded],
            audioDuration: duration,
            reactions: [],
            deliveredTo: [],
            readBy: [],
            isEdited: false,
            isDeleted: false,
            createdAt: new Date().toISOString(),
            status: "sending",
        };
        insertOptimistic(optimistic);
        try {
            const msg = await apiPost(
                `/api/v1/conversations/${convId}/messages`,
                {
                    content: undefined,
                    attachments: [uploaded],
                    audioDuration: duration,
                },
            );
            setMessages((prev) =>
                prev.map((m) =>
                    m.tempId === tempId ? { ...msg, status: "sent" } : m,
                ),
            );
            if (msg?.id) mergeCachedMessage(convId, msg).catch(() => {});
            removeOutbox(tempId).catch(() => {});
        } catch {
            setMessages((prev) =>
                prev.map((m) =>
                    m.tempId === tempId ? { ...m, status: "failed" } : m,
                ),
            );
            setSendError("Could not send the voice message.");
        }
    };

    // Live seconds counter while recording (keyed on the stable start time so
    // the interval isn't recreated on every tick).
    // biome-ignore lint/correctness/useExhaustiveDependencies: startedAt is the stable per-session key.
    useEffect(() => {
        if (!recording) return undefined;
        const t = setInterval(() => {
            setRecording((prev) =>
                prev
                    ? {
                          ...prev,
                          seconds: Math.floor(
                              (Date.now() - prev.startedAt) / 1000,
                          ),
                      }
                    : prev,
            );
        }, 500);
        return () => clearInterval(t);
    }, [recording?.startedAt]);

    // Drop any in-flight recording when the panel unmounts or the open
    // conversation changes (cancelled via the recorder's onstop handler).
    // biome-ignore lint/correctness/useExhaustiveDependencies: convId is the only real trigger.
    useEffect(() => {
        return () => {
            const r = recorderRef.current;
            if (r && r.state !== "inactive") {
                pendingVoiceRef.current = { cancelled: true, duration: 0 };
                try {
                    r.stop();
                } catch {
                    /* already stopped */
                }
            }
            recorderRef.current = null;
        };
    }, [convId]);

    const toggleReaction = async (id, emoji) => {
        setReactionFor(null);
        try {
            const data = await apiPost(`/api/v1/messages/${id}/reactions`, {
                emoji,
            });
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === id ? { ...m, reactions: data.reactions } : m,
                ),
            );
        } catch {
            /* socket echo will still update if it succeeds server-side */
        }
    };

    const removeMessage = async (id) => {
        setMessages((prev) =>
            prev.map((m) =>
                m.id === id ? { ...m, isDeleted: true, content: "" } : m,
            ),
        );
        try {
            await apiDelete(`/api/v1/messages/${id}`);
        } catch {
            /* socket echo reconciles on success */
        }
    };

    const saveEdit = async (id) => {
        const content = editText.trim();
        if (!content) return;
        const prevContent = messages.find((m) => m.id === id)?.content;
        setMessages((prev) =>
            prev.map((m) =>
                m.id === id ? { ...m, content, isEdited: true } : m,
            ),
        );
        setEditingId(null);
        try {
            const msg = await apiPatch(`/api/v1/messages/${id}`, { content });
            setMessages((prev) =>
                prev.map((m) => (m.id === id ? { ...m, ...msg } : m)),
            );
        } catch {
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === id
                        ? { ...m, content: prevContent, isEdited: false }
                        : m,
                ),
            );
        }
    };

    const markConversationRead = async () => {
        if (!convId || !firstUnreadId) return;
        try {
            await apiPatch(`/api/v1/conversations/${convId}/read`, {});
            // optimistic: mark all as read locally so separator disappears immediately
            setMessages((prev) =>
                prev.map((m) =>
                    m.senderId !== userId && !m.isDeleted && m.type !== "system"
                        ? {
                              ...m,
                              readBy: [
                                  ...(m.readBy || []),
                                  { userId, readAt: new Date().toISOString() },
                              ],
                          }
                        : m,
                ),
            );
            if (onConversationUpdate && conversation) {
                onConversationUpdate({ ...conversation, unreadCount: 0 });
            }
        } catch {}
    };

    const handleMarkUnread = async (messageId) => {
        if (!convId || !messageId) return;
        try {
            const data = await apiPost(
                `/api/v1/conversations/${convId}/unread`,
                {
                    messageId,
                },
            );
            // optimistic: make this message and all newer messages from others unread
            const anchor = messages.find((m) => m.id === messageId);
            const anchorTime = anchor
                ? new Date(anchor.createdAt).getTime()
                : 0;
            setMessages((prev) =>
                prev.map((m) => {
                    if (
                        m.senderId === userId ||
                        m.isDeleted ||
                        m.type === "system"
                    )
                        return m;
                    const t = new Date(m.createdAt).getTime();
                    if (t >= anchorTime) {
                        return {
                            ...m,
                            readBy: (m.readBy || []).filter(
                                (r) =>
                                    (r.userId || r).toString() !==
                                    userId.toString(),
                            ),
                        };
                    }
                    return m;
                }),
            );
            if (onConversationUpdate && conversation) {
                const unreadCount =
                    data?.unreadCount ?? data?.data?.unreadCount ?? null;
                if (typeof unreadCount === "number") {
                    onConversationUpdate({ ...conversation, unreadCount });
                }
            }
        } catch (err) {
            window.alert(err?.message || "Could not mark as unread");
        }
    };

    // ── Message actions: copy / share / profile / block / pin / forward ────────

    const handleCopyMessage = async (m) => {
        const text = messageText(m);
        if (!text) return;
        const ok = await copyText(text);
        showNotice(ok ? "Copied to clipboard" : "Couldn't copy");
    };

    const toggleSavedMessage = async (m) => {
        const next = !m.saved;
        // Optimistic flip, then reconcile with the server payload.
        setMessages((prev) =>
            prev.map((x) => (x.id === m.id ? { ...x, saved: next } : x)),
        );
        try {
            const updated = await apiPost(`/api/v1/messages/${m.id}/save`, {
                saved: next,
            });
            setMessages((prev) =>
                prev.map((x) => (x.id === m.id ? { ...x, ...updated } : x)),
            );
            showNotice(next ? "Saved" : "Removed from saved");
        } catch {
            setMessages((prev) =>
                prev.map((x) => (x.id === m.id ? { ...x, saved: !next } : x)),
            );
        }
    };

    const handleShareMessage = async (m) => {
        const text = messageText(m);
        if (!text) return;
        if (typeof navigator !== "undefined" && navigator.share) {
            try {
                await navigator.share({ text });
                return;
            } catch (err) {
                // AbortError = user cancelled; other failures fall back to copy.
                if (err?.name === "AbortError") return;
            }
        }
        const ok = await copyText(text);
        showNotice(ok ? "Copied to clipboard" : "Couldn't copy");
    };

    const openProfileForSender = (m) => {
        const sender = membersById[m.senderId];
        if (!sender?.username) return;
        setProfileUsername(sender.username);
    };

    const handlePinToggle = async (m) => {
        if (!m.id || pinBusyId) return;
        setPinBusyId(m.id);
        try {
            const updated = await apiPost(`/api/v1/messages/${m.id}/pin`, {
                pinned: !m.pinnedAt,
            });
            setMessages((prev) =>
                prev.map((x) =>
                    x.id === updated.id ? { ...x, ...updated } : x,
                ),
            );
            setPinnedMessages((prev) => {
                const rest = prev.filter((p) => p.id !== updated.id);
                if (updated.pinnedAt) return [updated, ...rest].slice(0, 10);
                return rest;
            });
            showNotice(
                updated.pinnedAt ? "Message pinned" : "Message unpinned",
            );
        } catch (err) {
            showNotice(err?.message || "Could not pin message");
        } finally {
            setPinBusyId(null);
        }
    };

    const scrollToMessageId = async (id) => {
        const el = document.getElementById(`msg-${id}`);
        if (el) {
            el.scrollIntoView({ block: "center" });
            return;
        }
        // Older than the loaded window — fetch a page centered on the anchor.
        try {
            const data = await apiGet(
                `/api/v1/conversations/${convId}/messages?around=${encodeURIComponent(id)}&limit=50`,
            );
            const page = data?.messages || [];
            if (page.some((m) => m.id === id)) {
                setMessages(page);
                requestAnimationFrame(() => {
                    document
                        .getElementById(`msg-${id}`)
                        ?.scrollIntoView({ block: "center" });
                });
            }
        } catch {}
    };

    // ── Selection mode (multi-action) ─────────────────────────────────────────

    const enterSelectMode = (m) => {
        setSelectedIds(new Set([m.id]));
        setSelectMode(true);
    };
    const toggleSelected = (id) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };
    const exitSelectMode = () => {
        setSelectMode(false);
        setSelectedIds(new Set());
    };
    const selectedMessages = messages.filter(
        (m) => m.id && selectedIds.has(m.id),
    );
    const selectionAllOwn =
        selectedMessages.length > 0 &&
        selectedMessages.every((m) => m.senderId === userId);

    const handleCopySelected = async () => {
        const text = selectedMessages
            .map(messageText)
            .filter(Boolean)
            .join("\n\n");
        if (!text) return;
        const ok = await copyText(text);
        showNotice(ok ? "Copied messages" : "Couldn't copy");
    };

    const openForwardPicker = async (msgs) => {
        setForwardQueue(msgs);
        setForwardError(null);
        setForwardConvs([]);
        setForwardOpen(true);
        try {
            const list = await apiGet("/api/v1/conversations");
            setForwardConvs(Array.isArray(list) ? list : []);
        } catch (err) {
            setForwardError(err?.message || "Could not load conversations");
        }
    };
    const handleForwardSelected = () => {
        if (selectedMessages.length) openForwardPicker(selectedMessages);
    };
    const closeForwardPicker = () => {
        setForwardOpen(false);
        setForwardQueue([]);
        setForwardError(null);
        exitSelectMode();
    };

    const confirmForwardTarget = async (targetConvId) => {
        if (!forwardQueue.length || forwardBusy) return;
        setForwardBusy(true);
        setForwardError(null);
        let ok = 0;
        let firstErr = null;
        for (const m of forwardQueue) {
            if (!m.id) continue;
            try {
                await apiPost(
                    `/api/v1/conversations/${targetConvId}/messages`,
                    {
                        forwardedFromId: m.id,
                    },
                );
                ok += 1;
            } catch (err) {
                firstErr = firstErr || err?.message || "Could not forward";
            }
        }
        setForwardBusy(false);
        if (ok === 0) {
            setForwardError(firstErr || "Could not forward");
            return;
        }
        setForwardOpen(false);
        setForwardQueue([]);
        exitSelectMode();
        showNotice(ok === 1 ? "Message forwarded" : `${ok} messages forwarded`);
    };

    const handleDeleteSelected = async () => {
        if (!selectionAllOwn || !selectedMessages.length) return;
        if (!window.confirm(`Delete ${selectedMessages.length} message(s)?`))
            return;
        const ids = selectedMessages.map((m) => m.id);
        setMessages((prev) => prev.filter((m) => !ids.includes(m.id)));
        exitSelectMode();
        let failed = 0;
        for (const id of ids) {
            try {
                await apiDelete(`/api/v1/messages/${id}`);
            } catch {
                failed += 1;
            }
        }
        showNotice(
            failed
                ? `Deleted ${ids.length - failed} message(s)`
                : `Deleted ${ids.length} message(s)`,
        );
    };

    // Auto-mark read when user scrolls near bottom and unread separator is visible
    useEffect(() => {
        if (!firstUnreadId || !scrollRef.current) return;
        const el = scrollRef.current;
        const isNearBottom =
            el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        if (!isNearBottom) return;
        const t = setTimeout(() => {
            markConversationRead();
        }, 800);
        return () => clearTimeout(t);
    }, [firstUnreadId, messages.length]);

    // Per-Space palette needs the current theme colors; call this hook above the
    // conditional return so the hook order never changes between renders.
    const memberColors = useTheme().colors;

    if (!conversation) return <EmptyState />;

    const headerName = isChannel
        ? `#${conversation.name || "general"}`
        : isGroup
          ? conversation.name || "Group"
          : otherName;
    const headerAvatar = isChannel
        ? {
              name: `#${conversation.name || "general"}`,
              avatarStyle: null,
              avatarUrl: conversation.avatarUrl || null,
          }
        : isGroup
          ? {
                name: conversation.name || "Group",
                avatarStyle: null,
                avatarUrl: conversation.avatarUrl,
            }
          : {
                name: participantAvatarName(other),
                avatarStyle: other?.avatarStyle,
                avatarUrl: other?.avatarUrl,
            };

    // Per-Space palette: while a Space channel is open, scope the Space's colors
    // to this panel. CSS custom properties cascade to descendants only, so the
    // chat view takes on the Space's identity while the rest of the app (sidebar,
    // lists) keeps the member's own theme.
    const spaceAppearance = space?.appearance;
    const spaceThemeVars =
        isChannel && spaceAppearance && customIsActive(spaceAppearance)
            ? cssVarsForColors(derivePalette(memberColors, spaceAppearance))
            : undefined;

    // Chat look: wallpaper + bubble style. In a Space channel the Space's own
    // look wins per-field when it is set (a Space may pin "plain" to override
    // members' wallpapers); otherwise the member's personal chat appearance
    // applies (defaults: plain + rounded). Both values re-tint through CSS
    // vars, so they compose with per-Space palettes automatically.
    const chatLook = resolveChatLook({
        conversationAppearance:
            isChannel || !conversation?.appearance
                ? null
                : conversation.appearance,
        spaceAppearance: isChannel ? spaceAppearance : null,
        personalAppearance: currentUser?.appearance,
    });
    const chatWallpaperCss = wallpaperCss(chatLook.wallpaper);

    const pinPreview = (pm) => {
        if (pm.content) {
            const flat = pm.content.replace(/\s+/g, " ").trim();
            return flat.length > 48 ? `${flat.slice(0, 48)}…` : flat;
        }
        const files = pm.attachments || [];
        if (files.length === 1) {
            const f = files[0];
            if (f.kind === "image") return "📷 photo";
            if (f.kind === "audio") return "🎙️ Voice message";
            return `📎 ${f.fileName}`;
        }
        if (files.length > 1) return `📎 ${files.length} attachments`;
        return "Message";
    };
    const actionBtnCls =
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40";

    // Fresh handlers + per-conversation context for <MessageRows>. Mutated in
    // place on every render so the memo boundary sees a stable prop identity
    // while rows always call the latest closures when they do re-render.
    rowsCtx.current = {
        userId,
        otherId,
        otherName,
        isGroup,
        isChannel,
        isDm,
        membersById,
        participants: conversation?.participants || [],
        viewerId: isChannel ? undefined : userId,
        isBlockedByMe,
        setProfileUsername,
        setEditingId,
        setEditText,
        toggleReactionPicker: (id) =>
            setReactionFor((cur) => (cur === id ? null : id)),
        toggleReaction,
        saveEdit,
        removeMessage,
        retry,
        handleReply,
        handleMarkUnread,
        handleCopyMessage,
        toggleSavedMessage,
        openForwardPicker,
        handlePinToggle,
        enterSelectMode,
        handleShareMessage,
        openThread,
        openProfileForSender,
        handleUnblock,
        handleBlock,
        toggleSelected,
    };

    return (
        <div
            className={`relative isolate flex h-full min-w-0 flex-col overflow-hidden bg-[var(--bg-base)] kivo-bubbles-${chatLook.bubbleStyle}`}
            style={spaceThemeVars}
        >
            {/* Wallpaper layer — sits under every opaque surface (header,
                pinned banner, composer) and shows through the transparent
                message list, fixed while messages scroll. */}
            {convId && chatWallpaperCss && (
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 z-0"
                    style={chatWallpaperCss}
                />
            )}
            {/* Header — keep visible on mobile when keyboard opens (sticky + bg) */}
            <div className="relative z-10 flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-base)] px-4 max-md:sticky max-md:top-0 max-md:z-30 max-md:shrink-0">
                {onBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        aria-label="Back to conversations"
                        className="flex items-center gap-1 rounded-full bg-[#1c1c1c] border border-[#2a2a2a] px-3 py-1.5 text-[13px] font-medium text-white shadow-sm transition-colors duration-200 hover:bg-[#232323]"
                    >
                        <ChevronLeft />
                    </button>
                )}
                <Avatar
                    name={headerAvatar.name}
                    online={isGroup || isChannel ? false : otherOnline}
                    avatarStyle={headerAvatar.avatarStyle}
                    url={headerAvatar.avatarUrl}
                    size="xl"
                />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                        {headerName}
                    </p>
                    <p className="truncate text-[12px] text-[var(--text-muted)]">
                        {isGroup || isChannel ? (
                            <span>
                                {conversation.participants?.length || 0} members
                                {isChannel ? " • Space channel" : ""}
                            </span>
                        ) : (
                            <StatusText
                                online={otherOnline}
                                lastActiveAt={
                                    lastActiveByUser[otherId] ||
                                    other?.lastActiveAt ||
                                    null
                                }
                            />
                        )}
                    </p>
                </div>
                {conversation && !isChannel && (
                    <button
                        type="button"
                        onClick={() => setLookOpen(true)}
                        aria-label="Chat look"
                        className="flex size-9 items-center justify-center rounded-nav border border-[var(--border)] text-[var(--text-muted)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
                    >
                        <Palette className="h-5 w-5" />
                    </button>
                )}
                {(isGroup || isChannel) && onOpenGroupSettings && (
                    <button
                        type="button"
                        onClick={onOpenGroupSettings}
                        aria-label="Group settings"
                        className="flex size-9 items-center justify-center rounded-nav border border-[var(--border)] text-[var(--text-muted)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
                    >
                        <Users className="h-5 w-5" />
                    </button>
                )}
                {isDm && otherId && isMobile && (
                    <div ref={moreRef} className="relative">
                        <motion.button
                            type="button"
                            onClick={() => setShowMore((v) => !v)}
                            aria-haspopup="menu"
                            aria-expanded={showMore}
                            aria-label="More options"
                            whileTap={reduce ? undefined : { scale: 0.96 }}
                            className="flex size-9 items-center justify-center rounded-nav border border-[var(--border)] text-[var(--text-muted)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
                        >
                            <MoreVertical className="h-5 w-5" />
                        </motion.button>
                        <AnimatePresence>
                            {showMore && (
                                <motion.div
                                    role="menu"
                                    initial={
                                        reduce
                                            ? { opacity: 0 }
                                            : {
                                                  opacity: 0,
                                                  y: 6,
                                                  scale: 0.98,
                                                  filter: "blur(4px)",
                                              }
                                    }
                                    animate={{
                                        opacity: 1,
                                        y: 0,
                                        scale: 1,
                                        filter: "blur(0px)",
                                    }}
                                    exit={
                                        reduce
                                            ? { opacity: 0 }
                                            : {
                                                  opacity: 0,
                                                  y: 4,
                                                  scale: 0.98,
                                                  filter: "blur(4px)",
                                              }
                                    }
                                    transition={
                                        reduce
                                            ? { duration: 0 }
                                            : {
                                                  duration: 0.22,
                                                  ease: [0.22, 1, 0.36, 1],
                                              }
                                    }
                                    className="absolute right-0 top-full z-30 mt-2 min-w-48 origin-top-right overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-1.5 shadow-xl"
                                >
                                    <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => {
                                            setShowMore(false);
                                            setProfileUsername(
                                                other?.username || otherName,
                                            );
                                        }}
                                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-[var(--text-primary)] hover:bg-[var(--hover)]"
                                    >
                                        <User className="h-4 w-4" /> Profile
                                    </button>
                                    <div className="mx-3 my-1 h-px bg-[var(--border)]" />
                                    {isBlockedByMe ? (
                                        <button
                                            type="button"
                                            role="menuitem"
                                            disabled={blockBusy}
                                            onClick={handleUnblock}
                                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-[var(--text-primary)] hover:bg-[var(--hover)] disabled:opacity-40"
                                        >
                                            <ShieldBan className="h-4 w-4" />{" "}
                                            Unblock {otherName}
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            role="menuitem"
                                            disabled={blockBusy}
                                            onClick={handleBlock}
                                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-[var(--destructive)] hover:bg-[var(--hover)] disabled:opacity-40"
                                        >
                                            <Ban className="h-4 w-4" /> Block{" "}
                                            {otherName}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        role="menuitem"
                                        disabled={blockBusy}
                                        onClick={handleRemoveFriend}
                                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--destructive)] disabled:opacity-40"
                                    >
                                        <UserMinus className="h-4 w-4" /> Remove
                                        friend
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Pinned messages banner — newest pins first, jump-to-message on tap */}
            {pinnedMessages.length > 0 && !selectMode && (
                <div className="relative z-10 flex shrink-0 items-center gap-2 overflow-x-auto border-b border-[var(--border)] bg-[var(--bg-surface)] px-4 py-1.5 scrollbar-none">
                    <Pin className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                    {pinnedMessages.slice(0, 3).map((pm) => (
                        <button
                            key={pm.id}
                            type="button"
                            onClick={() => scrollToMessageId(pm.id)}
                            className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-base)] px-2.5 py-0.5 text-[11px] text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
                        >
                            <span className="font-medium text-[var(--text-primary)]">
                                {senderName(pm.senderId)}
                            </span>
                            <span className="max-w-40 truncate">
                                {pinPreview(pm)}
                            </span>
                        </button>
                    ))}
                    {pinnedMessages.length > 3 && (
                        <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
                            +{pinnedMessages.length - 3} more
                        </span>
                    )}
                </div>
            )}

            {/* Messages */}
            <div
                ref={scrollRef}
                onScroll={(e) => {
                    if (e.currentTarget.scrollTop <= 8) loadOlder();
                    const el = e.currentTarget;
                    const dist =
                        el.scrollHeight - el.scrollTop - el.clientHeight;
                    setShowJumpPill(dist > PILL_SHOW_PX);
                    // if near bottom and unread exists, mark as read (removes separator)
                    if (firstUnreadId) {
                        const nearBottom = dist < NEAR_BOTTOM_PX;
                        if (nearBottom) markConversationRead();
                    }
                }}
                className="t-scroll relative z-10 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain touch-pan-y px-4 py-4 max-md:pt-3 md:mt-12"
                style={{ overscrollBehavior: "contain" }}
            >
                {loadingHistory && (
                    <p className="py-2 text-center text-[12px] text-[var(--text-muted)]">
                        Loading…
                    </p>
                )}
                <div
                    key={convId}
                    className="t-panel-in mx-auto flex max-w-3xl flex-col"
                >
                    <MessageRows
                        messages={messages}
                        threadSummaries={threadSummaries}
                        onlineUsers={onlineUsers}
                        firstUnreadId={firstUnreadId}
                        editingId={editingId}
                        editText={editText}
                        reactionFor={reactionFor}
                        replyingToId={replyingTo ? replyingTo.id : null}
                        selectMode={selectMode}
                        selectedIds={selectedIds}
                        blockBusy={blockBusy}
                        isMobile={isMobile}
                        ctx={rowsCtx}
                    />
                    {typing && (
                        <div className="flex items-center gap-2 px-1 text-[12px] text-[var(--text-muted)]">
                            <span className="flex gap-1">
                                <span className="size-1.5 animate-pulse rounded-full bg-[var(--text-muted)]" />
                                <span className="size-1.5 animate-pulse rounded-full bg-[var(--text-muted)] [animation-delay:150ms]" />
                                <span className="size-1.5 animate-pulse rounded-full bg-[var(--text-muted)] [animation-delay:300ms]" />
                            </span>
                            {typerName || headerName} is typing…
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>
            </div>

            {/* Jump-to-latest pill — only when scrolled up off the live edge */}
            <AnimatePresence>
                {showJumpPill && (
                    <motion.button
                        key="jump-latest"
                        type="button"
                        onClick={() => scrollToBottom()}
                        aria-label={
                            unreadCount > 0
                                ? `Jump to latest, ${unreadCount} new messages`
                                : "Jump to latest"
                        }
                        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                        transition={
                            reduce
                                ? { duration: 0 }
                                : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }
                        }
                        className="absolute bottom-24 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] py-1.5 pr-3.5 pl-3 text-[12px] font-semibold text-[var(--text-primary)] shadow-xl hover:bg-[var(--hover)]"
                    >
                        {unreadCount > 0 ? (
                            <span className="flex size-5 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-bold text-[var(--on-accent)]">
                                {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                        ) : null}
                        {unreadCount > 0 ? "New messages" : "Latest"}
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Composer / selection toolbar */}
            <div className="relative z-20 shrink-0 border-t border-[var(--border)] p-3 pb-[max(env(safe-area-inset-bottom),1rem)]">
                {selectMode && (
                    <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 rounded-inputs border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2">
                        <span className="flex items-center gap-2 text-[13px] font-medium text-[var(--text-primary)]">
                            <CheckCheck className="h-4 w-4 text-[var(--accent)]" />
                            {selectedMessages.length} selected
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={handleCopySelected}
                                disabled={!selectedMessages.length}
                                className={actionBtnCls}
                            >
                                <Copy className="h-4 w-4" /> Copy
                            </button>
                            <button
                                type="button"
                                onClick={handleForwardSelected}
                                disabled={!selectedMessages.length}
                                className={actionBtnCls}
                            >
                                <Forward className="h-4 w-4" /> Forward
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteSelected}
                                disabled={!selectionAllOwn}
                                title={
                                    selectionAllOwn
                                        ? "Delete selected messages"
                                        : "Only your own messages can be deleted"
                                }
                                className={`${actionBtnCls} ${
                                    selectionAllOwn
                                        ? "text-[var(--destructive)]"
                                        : ""
                                }`}
                            >
                                <Trash className="h-4 w-4" /> Delete
                            </button>
                            <button
                                type="button"
                                onClick={exitSelectMode}
                                className={`${actionBtnCls} text-[var(--text-primary)]`}
                            >
                                <X className="h-4 w-4" /> Cancel
                            </button>
                        </div>
                    </div>
                )}
                <div
                    className="mx-auto max-w-3xl"
                    style={selectMode ? { display: "none" } : undefined}
                >
                    {replyingTo &&
                        !isBlockedByMe &&
                        !isBlockedByOther &&
                        canPost && (
                            <div className="mb-2 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2">
                                <div className="flex items-start gap-2 min-w-0">
                                    <span className="shrink-0 text-[var(--accent)]">
                                        <Reply className="h-4 w-4" />
                                    </span>
                                    <div className="min-w-0 flex-1 overflow-hidden">
                                        <span className="block text-[12px] font-medium text-[var(--text-primary)]">
                                            {senderName(replyingTo.senderId)}
                                        </span>
                                        <span className="block w-full break-words text-[12px] text-[var(--text-muted)] [overflow-wrap:anywhere]">
                                            {replyingTo.content}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={cancelReply}
                                        className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                        aria-label="Cancel reply"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    <AnimatePresence mode="wait">
                        {isBlockedByOther ? (
                            <motion.div
                                key="blocked-other"
                                initial={
                                    reduce
                                        ? { opacity: 0 }
                                        : {
                                              opacity: 0,
                                              y: 8,
                                              filter: "blur(4px)",
                                          }
                                }
                                animate={{
                                    opacity: 1,
                                    y: 0,
                                    filter: "blur(0px)",
                                }}
                                exit={
                                    reduce
                                        ? { opacity: 0 }
                                        : {
                                              opacity: 0,
                                              y: -6,
                                              filter: "blur(4px)",
                                          }
                                }
                                transition={
                                    reduce
                                        ? { duration: 0 }
                                        : {
                                              duration: 0.24,
                                              ease: [0.22, 1, 0.36, 1],
                                          }
                                }
                                className="flex items-center justify-center gap-2 rounded-inputs border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-4 py-3 text-sm text-[var(--destructive)]"
                            >
                                <Ban className="h-4 w-4 shrink-0" />
                                <span>{otherName} blocked you</span>
                            </motion.div>
                        ) : isBlockedByMe ? (
                            <motion.div
                                key="blocked-me"
                                initial={
                                    reduce
                                        ? { opacity: 0 }
                                        : {
                                              opacity: 0,
                                              y: 8,
                                              filter: "blur(4px)",
                                          }
                                }
                                animate={{
                                    opacity: 1,
                                    y: 0,
                                    filter: "blur(0px)",
                                }}
                                exit={
                                    reduce
                                        ? { opacity: 0 }
                                        : {
                                              opacity: 0,
                                              y: -6,
                                              filter: "blur(4px)",
                                          }
                                }
                                transition={
                                    reduce
                                        ? { duration: 0 }
                                        : {
                                              duration: 0.24,
                                              ease: [0.22, 1, 0.36, 1],
                                          }
                                }
                                className="flex items-center justify-between gap-3 rounded-inputs border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--text-muted)]"
                            >
                                <span className="flex items-center gap-2">
                                    <Ban className="h-4 w-4 shrink-0" />
                                    <span>You blocked {otherName}</span>
                                </span>
                                <motion.button
                                    type="button"
                                    disabled={blockBusy}
                                    onClick={handleUnblock}
                                    whileTap={
                                        reduce ? undefined : { scale: 0.96 }
                                    }
                                    whileHover={
                                        reduce ? undefined : { scale: 1.02 }
                                    }
                                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--on-accent)] hover:opacity-90 disabled:opacity-40"
                                >
                                    Unblock
                                </motion.button>
                            </motion.div>
                        ) : !canPost ? (
                            <motion.div
                                key="announcement"
                                initial={
                                    reduce
                                        ? { opacity: 0 }
                                        : { opacity: 0, y: 8 }
                                }
                                animate={{ opacity: 1, y: 0 }}
                                exit={
                                    reduce
                                        ? { opacity: 0 }
                                        : { opacity: 0, y: -6 }
                                }
                                transition={
                                    reduce
                                        ? { duration: 0 }
                                        : {
                                              duration: 0.22,
                                              ease: [0.22, 1, 0.36, 1],
                                          }
                                }
                                className="flex items-center justify-center gap-2 rounded-inputs border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--text-muted)]"
                            >
                                <Lock className="h-4 w-4 shrink-0" />
                                <span>
                                    Only admins can post in this announcement
                                    channel
                                </span>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="composer"
                                initial={
                                    reduce
                                        ? { opacity: 0 }
                                        : { opacity: 0, y: 8 }
                                }
                                animate={{ opacity: 1, y: 0 }}
                                exit={
                                    reduce
                                        ? { opacity: 0 }
                                        : { opacity: 0, y: 6 }
                                }
                                transition={
                                    reduce
                                        ? { duration: 0 }
                                        : {
                                              duration: 0.22,
                                              ease: [0.22, 1, 0.36, 1],
                                          }
                                }
                                className="relative z-20 rounded-inputs border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1.5 shadow-[0_2px_12px_-4px_rgba(25,23,28,0.12)]"
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain"
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files?.length)
                                            addFiles(e.target.files);
                                        e.target.value = "";
                                    }}
                                />
                                <UploadPreview
                                    files={pendingFiles}
                                    onRemove={removeFile}
                                />
                                <div className="flex items-end gap-2">
                                    {recording ? (
                                        <div className="flex w-full items-center gap-3 px-1 py-1.5">
                                            <span className="relative flex size-2.5 shrink-0">
                                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--destructive)] opacity-60" />
                                                <span className="relative inline-flex size-2.5 rounded-full bg-[var(--destructive)]" />
                                            </span>
                                            <span className="shrink-0 text-sm tabular-nums text-[var(--text-primary)]">
                                                {formatRecordTime(
                                                    recording.seconds,
                                                )}
                                            </span>
                                            {!recording.cancelling && (
                                                <ArrowUp
                                                    className="size-3.5 shrink-0 text-[var(--text-muted)]"
                                                    aria-hidden
                                                />
                                            )}
                                            <span
                                                className={`min-w-0 flex-1 truncate text-[12px] transition-colors ${
                                                    recording.cancelling
                                                        ? "text-[var(--destructive)]"
                                                        : "text-[var(--text-muted)]"
                                                }`}
                                            >
                                                {recording.cancelling
                                                    ? "Release to cancel"
                                                    : "Release to send · slide up to cancel"}
                                            </span>
                                            <button
                                                type="button"
                                                aria-label="Cancel recording"
                                                onClick={cancelRecording}
                                                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            {mentionOpen && (
                                                <MentionAutocomplete
                                                    participants={getFilteredParticipants(
                                                        mentionQuery,
                                                    )}
                                                    query={mentionQuery}
                                                    selectedIndex={mentionIndex}
                                                    onSelect={
                                                        handleSelectMention
                                                    }
                                                />
                                            )}
                                            <button
                                                type="button"
                                                aria-label="Attach file"
                                                onClick={() =>
                                                    fileInputRef.current?.click()
                                                }
                                                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors duration-200 hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
                                            >
                                                <Paperclip className="h-5 w-5" />
                                            </button>

                                            <textarea
                                                ref={textareaRef}
                                                value={text}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setText(val);
                                                    setSendError(null);
                                                    emitTyping();
                                                    checkMentionTrigger(
                                                        val,
                                                        e.target.selectionStart,
                                                    );
                                                }}
                                                onPaste={(e) => {
                                                    // Pasting a screenshot/photo attaches it
                                                    // directly (text in the same paste still
                                                    // flows through normally).
                                                    const pasted = [
                                                        ...(e.clipboardData
                                                            ?.files || []),
                                                    ].filter((f) =>
                                                        f?.type?.startsWith(
                                                            "image/",
                                                        ),
                                                    );
                                                    if (
                                                        !pasted.length ||
                                                        !convId ||
                                                        !canPost ||
                                                        recording ||
                                                        uploadBusy
                                                    ) {
                                                        return;
                                                    }
                                                    const named = pasted.map(
                                                        (f, i) =>
                                                            f.name
                                                                ? f
                                                                : new File(
                                                                      [f],
                                                                      `Pasted image ${Date.now() + i}.png`,
                                                                      {
                                                                          type:
                                                                              f.type ||
                                                                              "image/png",
                                                                      },
                                                                  ),
                                                    );
                                                    addFiles(named);
                                                }}
                                                onClick={(e) => {
                                                    checkMentionTrigger(
                                                        text,
                                                        e.target.selectionStart,
                                                    );
                                                }}
                                                onKeyUp={(e) => {
                                                    if (
                                                        [
                                                            "ArrowLeft",
                                                            "ArrowRight",
                                                            "Home",
                                                            "End",
                                                        ].includes(e.key)
                                                    ) {
                                                        checkMentionTrigger(
                                                            text,
                                                            e.target
                                                                .selectionStart,
                                                        );
                                                    }
                                                }}
                                                onKeyDown={(e) => {
                                                    if (mentionOpen) {
                                                        const filtered =
                                                            getFilteredParticipants(
                                                                mentionQuery,
                                                            );
                                                        if (
                                                            e.key ===
                                                            "ArrowDown"
                                                        ) {
                                                            e.preventDefault();
                                                            setMentionIndex(
                                                                (prev) =>
                                                                    filtered.length
                                                                        ? (prev +
                                                                              1) %
                                                                          filtered.length
                                                                        : 0,
                                                            );
                                                            return;
                                                        }
                                                        if (
                                                            e.key === "ArrowUp"
                                                        ) {
                                                            e.preventDefault();
                                                            setMentionIndex(
                                                                (prev) =>
                                                                    filtered.length
                                                                        ? (prev -
                                                                              1 +
                                                                              filtered.length) %
                                                                          filtered.length
                                                                        : 0,
                                                            );
                                                            return;
                                                        }
                                                        if (
                                                            (e.key ===
                                                                "Enter" ||
                                                                e.key ===
                                                                    "Tab") &&
                                                            !e.shiftKey
                                                        ) {
                                                            e.preventDefault();
                                                            if (
                                                                filtered[
                                                                    mentionIndex
                                                                ]
                                                            ) {
                                                                handleSelectMention(
                                                                    filtered[
                                                                        mentionIndex
                                                                    ],
                                                                );
                                                            } else {
                                                                setMentionOpen(
                                                                    false,
                                                                );
                                                            }
                                                            return;
                                                        }
                                                        if (
                                                            e.key === "Escape"
                                                        ) {
                                                            e.preventDefault();
                                                            setMentionOpen(
                                                                false,
                                                            );
                                                            return;
                                                        }
                                                    }

                                                    // ↑ on an empty composer edits your
                                                    // last message (Telegram/Discord
                                                    // behavior). Mention popup takes
                                                    // precedence when open.
                                                    if (
                                                        e.key === "ArrowUp" &&
                                                        !text.trim() &&
                                                        editingId == null
                                                    ) {
                                                        const lastOwn = [
                                                            ...messages,
                                                        ]
                                                            .reverse()
                                                            .find(
                                                                (m) =>
                                                                    m.senderId ===
                                                                        userId &&
                                                                    !m.isDeleted &&
                                                                    m.type !==
                                                                        "system" &&
                                                                    Boolean(
                                                                        m.content,
                                                                    ),
                                                            );
                                                        if (lastOwn) {
                                                            e.preventDefault();
                                                            setEditingId(
                                                                lastOwn.id,
                                                            );
                                                            setEditText(
                                                                lastOwn.content,
                                                            );
                                                            return;
                                                        }
                                                    }

                                                    if (
                                                        e.key === "Enter" &&
                                                        !e.shiftKey
                                                    ) {
                                                        e.preventDefault();
                                                        send();
                                                    }
                                                }}
                                                placeholder="Type a message…"
                                                aria-label="Message"
                                                rows={1}
                                                className="max-h-40 min-h-[40px] w-full resize-none bg-transparent py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                                            />
                                            {isOffline && (
                                                <span className="absolute -top-6 right-0 whitespace-nowrap text-[11px] text-[var(--text-muted)]">
                                                    You're offline — text
                                                    messages will be queued
                                                </span>
                                            )}
                                            <motion.button
                                                type="button"
                                                onClick={send}
                                                disabled={
                                                    !text.trim() &&
                                                    !pendingFiles.some(
                                                        (f) =>
                                                            f.status ===
                                                            "pending",
                                                    )
                                                }
                                                whileTap={
                                                    reduce
                                                        ? undefined
                                                        : { scale: 0.96 }
                                                }
                                                className="rounded-nav bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--on-accent)] transition-[filter,opacity] duration-200 hover:brightness-110 active:scale-[0.97] disabled:opacity-40"
                                            >
                                                <Send className="h-5 w-5" />
                                            </motion.button>
                                        </>
                                    )}
                                </div>
                                {sendError && (
                                    <p className="mt-1.5 px-1 text-[11px] leading-snug text-[var(--destructive)]">
                                        {sendError}
                                    </p>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Mention profile drawer — local state, does not change route */}
            <ProfileDrawer
                username={profileUsername}
                open={Boolean(profileUsername)}
                onClose={() => setProfileUsername(null)}
                onMessage={(conv) => {
                    setProfileUsername(null);
                    if (onConversationUpdate && conv)
                        onConversationUpdate(conv);
                }}
            />

            {/* Forward picker — choose a conversation for the queued message(s) */}
            {forwardOpen && (
                <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
                    <button
                        type="button"
                        aria-label="Close forward picker"
                        onClick={closeForwardPicker}
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Forward messages"
                        className="relative z-10 flex max-h-[80dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] sm:rounded-2xl"
                    >
                        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
                            <div className="min-w-0">
                                <h2 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
                                    Forward to
                                </h2>
                                <p className="truncate text-[12px] text-[var(--text-muted)]">
                                    {forwardQueue.length === 1
                                        ? "1 message"
                                        : `${forwardQueue.length} messages`}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeForwardPicker}
                                aria-label="Close"
                                className="flex size-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto">
                            {forwardError && (
                                <p className="border-b border-[var(--border)] px-5 py-2.5 text-[12px] text-[var(--destructive)]">
                                    {forwardError}
                                </p>
                            )}
                            {!forwardError && forwardConvs.length === 0 ? (
                                <p className="py-10 text-center text-[12px] text-[var(--text-muted)]">
                                    Loading conversations…
                                </p>
                            ) : forwardError ? null : (
                                <ul className="flex flex-col gap-0.5 p-2">
                                    {forwardConvs.map((c) => {
                                        const label =
                                            c.type === "dm"
                                                ? participantName(
                                                      otherParticipant(
                                                          c,
                                                          userId,
                                                      ),
                                                  )
                                                : c.name || c.type;
                                        return (
                                            <li key={c.id}>
                                                <button
                                                    type="button"
                                                    disabled={forwardBusy}
                                                    onClick={() =>
                                                        confirmForwardTarget(
                                                            c.id,
                                                        )
                                                    }
                                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--hover)] disabled:opacity-50"
                                                >
                                                    <Avatar
                                                        name={label}
                                                        url={c.avatarUrl}
                                                        size="sm"
                                                    />
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate text-[13px] font-medium text-[var(--text-primary)]">
                                                            {label}
                                                        </span>
                                                        <span className="block text-[11px] text-[var(--text-muted)]">
                                                            {c.type === "dm"
                                                                ? "Direct message"
                                                                : c.type ===
                                                                    "group"
                                                                  ? `${c.participants?.length || 0} members`
                                                                  : "Space channel"}
                                                        </span>
                                                    </span>
                                                    <Forward className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Transient action feedback (copied / forwarded / deleted) */}
            {notice && (
                <div
                    role="status"
                    className="pointer-events-none fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-[12px] font-medium text-[var(--text-primary)] shadow-lg"
                >
                    {notice}
                </div>
            )}

            {/* Thread side panel — desktop drawer / mobile sheet over this chat */}
            {threadRoot && (
                <ThreadPanel
                    conversation={conversation}
                    root={threadRoot}
                    onClose={closeThread}
                    onActivity={refreshThreadSummaries}
                    onForward={(m) => openForwardPicker([m])}
                    onOpenProfile={(username) => setProfileUsername(username)}
                    isMobile={isMobile}
                />
            )}

            {/* Shared chat look editor (DM/group wallpaper + bubble style) */}
            {lookOpen && conversation && !isChannel && (
                <ConversationLookModal
                    conversation={conversation}
                    onClose={() => setLookOpen(false)}
                    onSaved={(updated) => {
                        setLookOpen(false);
                        if (onConversationUpdate && updated?.id)
                            onConversationUpdate(updated);
                    }}
                />
            )}
        </div>
    );
}

export default ChatPanel;
