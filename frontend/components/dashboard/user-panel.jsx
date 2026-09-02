"use client";

import { Ban, Eye, ShieldBan, UserMinus } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { Avatar } from "@/components/dashboard/avatar";
import { apiDelete, apiPost } from "@/lib/api";
import { useLiveLastActive } from "@/lib/last-active";
import { ProfileDrawer } from "@/components/profile/profile-drawer";

// Online / Offline status label — reuses the transitions-dev text-swap: the
// keyed span remounts on change so it blur-rises in (reduced-motion safe).
function StatusText({ online, lastActiveAt }) {
    const label = useLiveLastActive(lastActiveAt, online);
    return (
        <span key={label} className="t-text-swap">
            {label}
        </span>
    );
}

function DetailRow({ label, value }) {
    if (!value) return null;
    return (
        <div className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-[12px] text-[var(--text-muted)]">
                {label}
            </span>
            <span className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                {value}
            </span>
        </div>
    );
}

function formatJoined(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString([], { month: "long", year: "numeric" });
}

const EASE = [0.22, 1, 0.36, 1];

export function UserPanel({
    profile,
    loading,
    online,
    lastActiveAt,
    conversationCreatedAt,
    conversation,
    onConversationUpdate,
}) {
    const reduce = useReducedMotion();
    const [blockBusy, setBlockBusy] = useState(false);
    const [profileUsername, setProfileUsername] = useState(null);
    const isBlockedByMe = Boolean(conversation?.isBlockedByMe);
    const otherId =
        profile?.id || conversation?.otherParticipantIds?.[0] || null;
    const otherName = profile?.displayName || profile?.username || "this user";
  
    const handleBlock = async () => {
        if (!otherId || blockBusy) return;
        if (
            !window.confirm(
                `Block ${otherName}? You won't receive messages from them and the friendship will be removed.`,
            )
        )
            return;
        setBlockBusy(true);
        try {
            await apiPost(`/api/v1/users/${otherId}/block`, {});
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
    const handleUnfriend = async () => {
        if (!otherId || blockBusy) return;
        if (!window.confirm(`Remove ${otherName} from friends?`)) return;
        setBlockBusy(true);
        try {
            await apiDelete(`/api/v1/friends/${otherId}`);
            window.dispatchEvent(
                new CustomEvent("kivo:friend-removed", {
                    detail: { friendId: otherId },
                }),
            );
        } catch (err) {
            window.alert(err?.message || "Could not remove friend");
        } finally {
            setBlockBusy(false);
        }
    };

    const container = {
        hidden: {},
        show: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
    };
    const item = {
        hidden: { opacity: 0, y: 10, filter: "blur(3px)" },
        show: {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            transition: reduce
                ? { duration: 0 }
                : { duration: 0.45, ease: EASE },
        },
    };

    return (
        <>
        <motion.aside
            initial={
                reduce ? false : { opacity: 0, x: 28, filter: "blur(4px)" }
            }
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={
                reduce
                    ? { opacity: 0 }
                    : { opacity: 0, x: 28, filter: "blur(4px)" }
            }
            transition={
                reduce ? { duration: 0 } : { duration: 0.4, ease: EASE }
            }
            className="t-scroll hidden h-full w-[320px] shrink-0 flex-col overflow-y-auto border-l border-[var(--border)] bg-[var(--bg-elevated)] xl:flex"
            aria-label="Conversation details"
        >
            {/* Cover banner — animated GIF when the user has picked one, otherwise the
          default coral gradient. */}
            <div className="relative h-24 shrink-0 overflow-hidden bg-gradient-to-br from-accent-blue/40 to-[#6a4cf5]/40">
                {profile?.banner ? (
                    <img
                        src={profile.banner}
                        alt=""
                        aria-hidden="true"
                        className="h-full w-full object-cover"
                    />
                ) : null}
            </div>

            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="flex flex-col px-5 pb-6"
            >
                {/* Identity block — avatar overlaps the cover, with comfortable top gap. */}
                <motion.div
                    variants={item}
                    className="-mt-8 flex flex-col items-center text-center"
                >
                    <div className="rounded-[calc(var(--radius-cards)*0.5)] bg-[var(--bg-elevated)] p-1.5">
                        <Avatar
                            name={
                                profile?.displayName || profile?.username || "?"
                            }
                            online={online}
                            avatarStyle={profile?.avatarStyle}
                            url={profile?.avatarUrl}
                            size="xl"
                        />
                    </div>
                    <h2 className="mt-3 text-[18px] font-semibold leading-tight text-[var(--text-primary)]">
                        {profile?.displayName || profile?.username || "Unknown"}
                    </h2>
                    {profile?.username ? (
                        <p className="text-[13px] text-[var(--text-muted)]">
                            @{profile.username}
                        </p>
                    ) : null}
                    <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
                        <span
                            className={`size-2 rounded-full ${online ? "bg-[var(--online)]" : "bg-[var(--color-stone)]"}`}
                        />
                        <StatusText
                            online={online}
                            lastActiveAt={lastActiveAt || profile?.lastActiveAt}
                        />
                    </div>
                </motion.div>

                {/* Custom status line (the user's free-text status). */}
                {profile?.status ? (
                    <motion.div
                        variants={item}
                        className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5 text-center text-[13px] italic text-[var(--text-muted)]"
                    >
                        {profile.status}
                    </motion.div>
                ) : null}

                {/* About / bio. */}
                <motion.div variants={item} className="mt-4">
                    <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                        About
                    </p>
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-8 py-3.5">
                        {loading ? (
                            <div className="h-3 w-2/3 animate-pulse rounded-full bg-[var(--color-driftwood)]" />
                        ) : profile?.bio ? (
                            <p className="text-[13px] leading-relaxed text-[var(--text-primary)]">
                                {profile.bio}
                            </p>
                        ) : (
                            <p className="text-[13px] text-[var(--text-muted)]">
                                No bio yet.
                            </p>
                        )}
                    </div>
                </motion.div>

                {/* Structured details. */}
                <motion.div variants={item} className="mt-4">
                    <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                        Details
                    </p>
                    <div className="rounded-2xl divide-y divide-[var(--border)] border border-[var(--border)] bg-[var(--bg-surface)] px-4">
                        <DetailRow label="Email" value={profile?.email} />
                        <DetailRow
                            label="Member since"
                            value={formatJoined(profile?.createdAt)}
                        />
                        <DetailRow
                            label="Conversation started"
                            value={formatJoined(conversationCreatedAt)}
                        />
                    </div>
                </motion.div>

                <motion.p
                    variants={item}
                    className="mt-5 text-center text-[11px] text-[var(--text-muted)]"
                >
                    You can only see what this person chooses to share.
                </motion.p>

                {/* Public profile button */}
                {otherId && profile?.username && (
                    <motion.div variants={item} className="mt-4">
                        <motion.button
                            type="button"
                            onClick={() => setProfileUsername(profile.username)}
                            whileTap={reduce ? undefined : { scale: 0.98 }}
                            whileHover={reduce ? undefined : { scale: 1.01 }}
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5 text-[13px] font-medium text-[var(--text-primary)] transition-colors duration-150 hover:bg-[var(--hover)]"
                        >
                            <Eye className="h-4 w-4" />
                            Public profile
                        </motion.button>
                    </motion.div>
                )}

                {otherId && (
                    <motion.div
                        variants={item}
                        className="mt-5 flex flex-col gap-2.5"
                    >
                        <AnimatePresence mode="wait">
                            {isBlockedByMe ? (
                                <motion.button
                                    key="unblock"
                                    type="button"
                                    disabled={blockBusy}
                                    onClick={handleUnblock}
                                    initial={
                                        reduce
                                            ? { opacity: 0 }
                                            : { opacity: 0, y: 6 }
                                    }
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={
                                        reduce
                                            ? { opacity: 0 }
                                            : { opacity: 0, y: -4 }
                                    }
                                    transition={
                                        reduce
                                            ? { duration: 0 }
                                            : { duration: 0.22, ease: EASE }
                                    }
                                    whileTap={
                                        reduce ? undefined : { scale: 0.98 }
                                    }
                                    whileHover={
                                        reduce ? undefined : { scale: 1.01 }
                                    }
                                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5 text-[13px] font-medium text-[var(--text-primary)] transition-colors duration-150 hover:bg-[var(--hover)] disabled:opacity-40"
                                >
                                    <ShieldBan className="h-4 w-4" />
                                    Unblock {otherName}
                                </motion.button>
                            ) : (
                                <motion.button
                                    key="block"
                                    type="button"
                                    disabled={blockBusy}
                                    onClick={handleBlock}
                                    initial={
                                        reduce
                                            ? { opacity: 0 }
                                            : { opacity: 0, y: 6 }
                                    }
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={
                                        reduce
                                            ? { opacity: 0 }
                                            : { opacity: 0, y: -4 }
                                    }
                                    transition={
                                        reduce
                                            ? { duration: 0 }
                                            : { duration: 0.22, ease: EASE }
                                    }
                                    whileTap={
                                        reduce ? undefined : { scale: 0.98 }
                                    }
                                    whileHover={
                                        reduce ? undefined : { scale: 1.01 }
                                    }
                                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--destructive)]/30 bg-[var(--bg-surface)] px-4 py-2.5 text-[13px] font-medium text-[var(--destructive)] transition-colors duration-150 hover:bg-[var(--destructive)]/10 disabled:opacity-40"
                                >
                                    <Ban className="h-4 w-4" />
                                    Block {otherName}
                                </motion.button>
                            )}
                        </AnimatePresence>
                        <motion.button
                            type="button"
                            disabled={blockBusy}
                            onClick={handleUnfriend}
                            whileTap={reduce ? undefined : { scale: 0.98 }}
                            whileHover={reduce ? undefined : { scale: 1.01 }}
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5 text-[13px] font-medium text-[var(--text-muted)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--hover)] hover:text-[var(--destructive)] hover:border-[var(--destructive)]/30 disabled:opacity-40"
                            aria-label={`Remove ${otherName} from friends`}
                        >
                            <UserMinus className="h-4 w-4" />
                            Remove friend
                        </motion.button>
                    </motion.div>
                )}
            </motion.div>
        </motion.aside>

        <ProfileDrawer
            username={profileUsername}
            open={Boolean(profileUsername)}
            onClose={() => setProfileUsername(null)}
        />
        </>
    );
}

export default UserPanel;
