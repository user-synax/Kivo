"use client";

import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  Ban,
  CalendarDays,
  Hand,
  Loader2,
  MessageCircle,
  ShieldBan,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/dashboard/avatar";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { getSession } from "@/lib/auth";
import {
  effectAvatarClass,
  effectNameClass,
} from "@/lib/profile-effects";
import {
  SocialGlyph,
  socialLinksFor,
} from "@/lib/social-links";
import { cn } from "@/lib/utils";
import {
  ContributionGraph,
  ContributionGraphCalendar,
  ContributionGraphBlock,
  ContributionGraphFooter,
  ContributionGraphLegend,
  ContributionGraphTotalCount,
} from "@/components/ui/contribution-graph";

const EASE = [0.22, 1, 0.36, 1];

/* ── Animation variants ────────────────────────────────────────────────────
   Container / item stagger: content items rise in with blur, staggered 50ms
   apart. Mirrors the UserPanel and Navbar patterns used throughout the app.
   All variants respect reduced-motion by checking the `reduce` flag. ────── */

function useEntranceVariants() {
  const reduce = useReducedMotion();

  const container = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
  };

  const item = reduce
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: {
          opacity: 0,
          y: 10,
          filter: "blur(3px)",
        },
        show: {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          transition: { duration: 0.45, ease: EASE },
        },
      };

  return { reduce, container, item };
}

function formatJoined(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(d);
  } catch {
    return null;
  }
}

/* ── Pill button bases ─────────────────────────────────────────────────────
   Preserved from original — these remain the visual foundation. The motion
   wrappers below add interactive feel without changing the static styles. ── */
const pillPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--ink)] px-4 py-2 text-[13px] font-medium text-[var(--inverse-ink)] disabled:opacity-40 disabled:pointer-events-none";
const pillSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface-1)] px-4 py-2 text-[13px] font-medium text-[var(--ink)] disabled:opacity-40 disabled:pointer-events-none";
const pillGhost =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--hairline)] px-4 py-2 text-[13px] font-medium text-[var(--ink-muted)] disabled:opacity-40";

export function ProfileContent({
  username,
  profile: profileProp = null,
  onMessage,
  onClose,
  variant = "default",
}) {
  const router = useRouter();
  const { reduce, container, item } = useEntranceVariants();
  const [profile, setProfile] = useState(profileProp);
  const [loading, setLoading] = useState(!profileProp);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [rel, setRel] = useState(profileProp?.relationship ?? null);

  const isDrawer = variant === "drawer";

  useEffect(() => {
    if (profileProp) {
      setProfile(profileProp);
      setRel(profileProp.relationship ?? null);
      setLoading(false);
      return;
    }
    if (!username) return;
    let active = true;
    setLoading(true);
    setError(null);
    apiGet(
      `/api/v1/users/${encodeURIComponent(username)}/profile`,
    )
      .then((data) => {
        if (!active) return;
        setProfile(data);
        setRel(data?.relationship ?? null);
      })
      .catch((e) => {
        if (!active) return;
        setError(e?.message || "Could not load profile");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [username, profileProp]);

  useEffect(() => {
    if (profileProp?.relationship) setRel(profileProp.relationship);
  }, [profileProp?.relationship]);

  const name =
    profile?.displayName || profile?.username || username || "—";
  const handle = profile?.username
    ? `@${profile.username}`
    : username
      ? `@${username}`
      : "";
  // Social chips (GitHub included when present) — the contribution graph card
  // further down still renders separately when githubUsername is set.
  const socialLinks = socialLinksFor(profile);
  const joined = formatJoined(profile?.joinedAt);
  const isSelf =
    rel === "self" || getSession()?.username === profile?.username;
  const isBlockedByMe = Boolean(profile?.isBlockedByMe);
  const isBlockedByOther = Boolean(profile?.isBlockedByOther);
  const isBlocked = isBlockedByMe || isBlockedByOther;

  // Kivo Plus profile effect (avatar halo + gradient name).
  const profileEffect = profile?.profileEffect || "none";
  const pfxAvatar = effectAvatarClass(profileEffect);
  const pfxName = effectNameClass(profileEffect);

  const handleAddFriend = async () => {
    if (!profile?.username || busy) return;
    setBusy("add");
    try {
      await apiPost("/api/v1/friends/request", {
        identifier: profile.username,
      });
      setRel("outgoing");
      setProfile((p) =>
        p ? { ...p, relationship: "outgoing" } : p,
      );
    } catch (e) {
      window.alert(e?.message || "Could not send request");
    } finally {
      setBusy(null);
    }
  };

  const handleMessage = async () => {
    if (!profile?.id || busy || isBlocked) return;
    setBusy("message");
    try {
      const conv = await apiPost("/api/v1/conversations", {
        participantId: profile.id,
      });
      if (onMessage) {
        onMessage(conv);
      } else {
        try {
          localStorage.setItem(
            "kivo:selected-conversation",
            conv.id,
          );
        } catch {}
        router.push("/app");
      }
      onClose?.();
    } catch (e) {
      window.alert(e?.message || "Could not start conversation");
    } finally {
      setBusy(null);
    }
  };

  const handleBlock = async () => {
    if (!profile?.id || busy) return;
    if (
      !window.confirm(
        `Block ${name}? You won't see their messages.`,
      )
    )
      return;
    setBusy("block");
    try {
      await apiPost(`/api/v1/users/${profile.id}/block`, {});
      setProfile((p) =>
        p
          ? { ...p, isBlockedByMe: true, relationship: "none" }
          : p,
      );
      setRel("none");
    } catch (e) {
      window.alert(e?.message || "Could not block user");
    } finally {
      setBusy(null);
    }
  };

  const handleUnblock = async () => {
    if (!profile?.id || busy) return;
    setBusy("unblock");
    try {
      await apiPost(`/api/v1/users/${profile.id}/unblock`, {});
      setProfile((p) =>
        p ? { ...p, isBlockedByMe: false } : p,
      );
    } catch (e) {
      window.alert(e?.message || "Could not unblock user");
    } finally {
      setBusy(null);
    }
  };

  const handleUnfriend = async () => {
    if (!profile?.id || busy) return;
    if (
      !window.confirm(`Remove ${name} from friends?`)
    )
      return;
    setBusy("unfriend");
    try {
      await apiDelete(`/api/v1/friends/${profile.id}`);
      setRel("none");
      setProfile((p) =>
        p ? { ...p, relationship: "none" } : p,
      );
    } catch (e) {
      window.alert(e?.message || "Could not remove friend");
    } finally {
      setBusy(null);
    }
  };

  // "Wave at {name}" — a friendly ping delivered as a notification. The server
  // enforces a per-recipient cooldown; we mirror it client-side with a 1s
  // countdown so the button reads "Waved · Ns" and stays disabled meanwhile.
  const [waveLeft, setWaveLeft] = useState(0);
  const WAVE_COOLDOWN = 20;
  useEffect(() => {
    if (waveLeft <= 0) return undefined;
    const t = setInterval(() => {
      setWaveLeft((s) => {
        const next = s - 1;
        if (next <= 0) return 0;
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [waveLeft]);
  const handleWave = async () => {
    if (!profile?.id || busy || waveLeft > 0) return;
    setBusy("wave");
    try {
      const res = await apiPost(
        `/api/v1/notifications/${profile.id}/wave`,
        {},
      );
      const serverCd = Number(res?.cooldownSeconds);
      setWaveLeft(serverCd > 0 ? serverCd : WAVE_COOLDOWN);
    } catch (e) {
      // Respect a server-side cooldown verdict even when we hit one.
      const msg = e?.message || "Couldn't wave";
      if (e?.code === "WAVE_COOLDOWN") {
        const cd = Number(e?.extra?.cooldownSeconds);
        setWaveLeft(cd > 0 ? cd : WAVE_COOLDOWN);
      }
      window.alert(msg);
    } finally {
      setBusy(null);
    }
  };

  /* ── Loading skeleton ──────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div
        className={cn(
          "w-full overflow-hidden",
          "bg-[var(--canvas)]",
        )}
      >
        {/* Banner shimmer */}
        <div className="t-skel h-[132px] w-full rounded-none sm:h-[160px]" />
        <div className="px-5 py-6 sm:px-6">
          <div className="flex gap-4">
            {/* Avatar shimmer */}
            <div className="t-skel size-20 shrink-0 rounded-2xl sm:size-24" />
            {/* Name / handle shimmer */}
            <div className="flex-1 space-y-3 pt-1">
              <div className="t-skel h-5 w-32 rounded-full" />
              <div className="t-skel h-3 w-20 rounded-full" />
            </div>
          </div>
          {/* Actions shimmer */}
          <div className="mt-5 flex gap-2">
            <div className="t-skel h-10 w-28 rounded-full" />
            <div className="t-skel h-10 w-24 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  /* ── Error / empty state ──────────────────────────────────────────────── */
  if (error || !profile) {
    return (
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={
          reduce
            ? { duration: 0 }
            : { duration: 0.35, ease: EASE }
        }
        className="px-6 py-10 text-center"
      >
        <p className="text-sm text-[var(--ink-muted)]">
          {error || "Profile not found."}
        </p>
        {onClose && (
          <motion.button
            type="button"
            onClick={onClose}
            whileTap={reduce ? undefined : { scale: 0.97 }}
            whileHover={reduce ? undefined : { scale: 1.02 }}
            className={cn(pillSecondary, "mt-4")}
          >
            Close
          </motion.button>
        )}
      </motion.div>
    );
  }

  /* ── Main profile ──────────────────────────────────────────────────────── */
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={profile?.id || username}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0 }}
        transition={
          reduce
            ? { duration: 0 }
            : { duration: 0.25, ease: EASE }
        }
        className={cn(
          "flex w-full flex-col overflow-hidden bg-[var(--canvas)]",
          isDrawer && "rounded-t-[20px]",
        )}
      >
        {/* ── Banner ──────────────────────────────────────────────────────── */}
        <motion.div
          initial={
            reduce
              ? false
              : { opacity: 0, scale: 1.04 }
          }
          animate={{ opacity: 1, scale: 1 }}
          transition={
            reduce
              ? { duration: 0 }
              : { duration: 0.6, ease: EASE }
          }
          className="relative h-[132px] w-full shrink-0 overflow-hidden border-b border-[var(--hairline)] bg-[var(--surface-1)] sm:h-[160px]"
        >
          {profile.banner ? (
            <img
              src={profile.banner}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background:
                  "radial-gradient(120% 120% at 0% 0%, var(--accent-blue) 0%, transparent 55%), linear-gradient(135deg, #1c1c1c 0%, #141414 100%)",
              }}
              aria-hidden="true"
            />
          )}
          {/* Vignette */}
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"
            aria-hidden="true"
          />
          {/* Drawer close button */}
          {isDrawer && (
            <motion.button
              type="button"
              onClick={onClose}
              aria-label="Close"
              initial={
                reduce
                  ? false
                  : { opacity: 0, scale: 0.8 }
              }
              animate={{ opacity: 1, scale: 1 }}
              transition={
                reduce
                  ? { duration: 0 }
                  : {
                      duration: 0.3,
                      ease: EASE,
                      delay: 0.2,
                    }
              }
              whileTap={
                reduce ? undefined : { scale: 0.9 }
              }
              whileHover={
                reduce
                  ? undefined
                  : { backgroundColor: "rgba(0,0,0,0.55)" }
              }
              className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full border border-white/10 bg-black/30 text-white backdrop-blur-md transition-colors"
            >
              <X className="h-4 w-4" />
            </motion.button>
          )}
        </motion.div>

        {/* ── Content (staggered entrance) ────────────────────────────────── */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="px-5 pb-6 pt-0 sm:px-6"
        >
          {/* ── Identity: avatar + name ──────────────────────────────────── */}
          <motion.div
            variants={item}
            className="flex items-end gap-4"
          >
            <motion.span
              initial={
                reduce
                  ? false
                  : { opacity: 0, scale: 0.85, y: 8 }
              }
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
              }}
              transition={
                reduce
                  ? { duration: 0 }
                  : {
                      duration: 0.5,
                      ease: EASE,
                      delay: 0.15,
                    }
              }
              className={cn(
                "-mt-8 inline-block rounded-2xl bg-[var(--canvas)] p-1 sm:-mt-10",
                pfxAvatar,
              )}
            >
              <span
                className="inline-block rounded-xl p-[2px]"
                style={{ background: "var(--hairline)" }}
              >
                <Avatar
                  name={name}
                  avatarStyle={profile.avatarStyle}
                  url={profile.avatarUrl}
                  size="lg"
                />
              </span>
            </motion.span>
            <div className="min-w-0 flex-1 pb-1">
              <h1
                className={cn(
                  "flex items-center gap-1.5 truncate font-display text-[22px] font-semibold tracking-tight text-[var(--ink)] sm:text-[24px]",
                  pfxName,
                )}
              >
                {name}
                {profile.verified && profile.showBadge !== false && (
                  <VerifiedBadge size="sm" decorative />
                )}
              </h1>
              <p className="flex items-center gap-1.5 truncate text-[13px] text-[var(--ink-muted)]">
                {handle}
                {profile.country && (
                  <img
                    src={`https://flagcdn.com/w80/${profile.country.toLowerCase()}.png`}
                    alt={profile.country}
                    className="h-4 w-4 shrink-0 rounded-full object-cover"
                    loading="lazy"
                  />
                )}
              </p>
            </div>
          </motion.div>

          {/* ── Status line ──────────────────────────────────────────────── */}
          {profile.status && (
            <motion.p
              variants={item}
              className="mt-3 text-sm italic text-[var(--ink-muted)]"
            >
              &ldquo;{profile.status}&rdquo;
            </motion.p>
          )}

          {/* ── Bio ──────────────────────────────────────────────────────── */}
          {profile.bio ? (
            <motion.p
              variants={item}
              className="mt-4 border-l border-[var(--hairline)] pl-3 text-sm leading-relaxed text-[var(--ink)]/90"
            >
              {profile.bio}
            </motion.p>
          ) : (
            <motion.p
              variants={item}
              className="mt-4 text-sm text-[var(--ink-muted)]/70"
            >
              No bio yet.
            </motion.p>
          )}

          {/* ── Social links (GitHub/X/Instagram/YouTube/website chips) ──── */}
          {socialLinks.length > 0 && (
            <motion.div
              variants={item}
              className="mt-4 flex flex-wrap items-center gap-2"
            >
              {socialLinks.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={link.title}
                  aria-label={link.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface-1)] px-3 py-1.5 text-[12px] font-medium text-[var(--ink-muted)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[var(--ink)]/30 hover:text-[var(--ink)]"
                >
                  <SocialGlyph glyph={link.glyph} />
                  {link.label}
                </a>
              ))}
            </motion.div>
          )}

          {/* ── Meta row (joined + relationship badge) ───────────────────── */}
          <motion.div
            variants={item}
            className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--hairline-soft)] pt-4 text-[12px] text-[var(--ink-muted)]"
          >
            {joined && (
              <motion.span
                initial={
                  reduce
                    ? false
                    : { opacity: 0, y: 4 }
                }
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : {
                        duration: 0.35,
                        ease: EASE,
                        delay: 0.35,
                      }
                }
                className="inline-flex items-center gap-1.5"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Joined {joined}
              </motion.span>
            )}
            {rel === "friends" && (
              <motion.span
                initial={
                  reduce
                    ? false
                    : {
                        opacity: 0,
                        scale: 0.8,
                        filter: "blur(3px)",
                      }
                }
                animate={{
                  opacity: 1,
                  scale: 1,
                  filter: "blur(0px)",
                }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : {
                        duration: 0.35,
                        ease: [0.34, 1.36, 0.64, 1],
                        delay: 0.4,
                      }
                }
                className="inline-flex items-center gap-1.5"
              >
                &bull; Friends
              </motion.span>
            )}
            {rel === "outgoing" && (
              <motion.span
                initial={
                  reduce
                    ? false
                    : {
                        opacity: 0,
                        scale: 0.8,
                        filter: "blur(3px)",
                      }
                }
                animate={{
                  opacity: 1,
                  scale: 1,
                  filter: "blur(0px)",
                }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : {
                        duration: 0.35,
                        ease: [0.34, 1.36, 0.64, 1],
                        delay: 0.4,
                      }
                }
                className="inline-flex items-center gap-1.5"
              >
                &bull; Request sent
              </motion.span>
            )}
            {rel === "incoming" && (
              <motion.span
                initial={
                  reduce
                    ? false
                    : {
                        opacity: 0,
                        scale: 0.8,
                        filter: "blur(3px)",
                      }
                }
                animate={{
                  opacity: 1,
                  scale: 1,
                  filter: "blur(0px)",
                }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : {
                        duration: 0.35,
                        ease: [0.34, 1.36, 0.64, 1],
                        delay: 0.4,
                      }
                }
                className="inline-flex items-center gap-1.5"
              >
                &bull; Request received
              </motion.span>
            )}
          </motion.div>

          {/* ── Block banners ────────────────────────────────────────────── */}
          {isBlockedByOther && (
            <motion.div
              variants={item}
              className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-4 py-3 text-sm text-[var(--destructive)]"
            >
              <Ban className="h-4 w-4 shrink-0" />
              <span>{name} blocked you</span>
            </motion.div>
          )}
          {isBlockedByMe && !isBlockedByOther && (
            <motion.div
              variants={item}
              className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface-1)] px-4 py-3 text-sm text-[var(--ink-muted)]"
            >
              <span className="flex items-center gap-2">
                <Ban className="h-4 w-4 shrink-0" />
                You blocked {name}
              </span>
              <motion.button
                type="button"
                onClick={handleUnblock}
                disabled={busy === "unblock"}
                whileTap={
                  reduce ? undefined : { scale: 0.95 }
                }
                whileHover={
                  reduce ? undefined : { scale: 1.03 }
                }
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--ink)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--inverse-ink)] disabled:opacity-40"
              >
                Unblock
              </motion.button>
            </motion.div>
          )}

          {/* ── Action buttons ───────────────────────────────────────────── */}
          {!isSelf && (
            <motion.div
              variants={item}
              className="mt-5 flex flex-wrap items-center gap-2"
            >
              {/* Wave — a lightweight ping independent of the relationship
                  state (works for friends, strangers and pending requests).
                  Hidden entirely once either side is blocked. */}
              {!isBlocked && (
                <motion.button
                  type="button"
                  onClick={handleWave}
                  disabled={busy === "wave" || waveLeft > 0}
                  whileTap={reduce ? undefined : { scale: 0.97 }}
                  whileHover={reduce ? undefined : { scale: 1.02 }}
                  title={
                    waveLeft > 0
                      ? `You already waved — again in ${waveLeft}s`
                      : `Wave at ${name}`
                  }
                  className={cn(
                    pillSecondary,
                    waveLeft > 0 && "opacity-60",
                  )}
                >
                  {busy === "wave" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Hand className="h-4 w-4" />
                  )}
                  {busy === "wave"
                    ? "…"
                    : waveLeft > 0
                      ? `Waved · ${waveLeft}s`
                      : "Wave"}
                </motion.button>
              )}
              <AnimatePresence mode="wait">
                {isBlocked ? (
                  <motion.div
                    key="blocked-actions"
                    initial={
                      reduce
                        ? { opacity: 0 }
                        : {
                            opacity: 0,
                            y: 4,
                          }
                    }
                    animate={{ opacity: 1, y: 0 }}
                    exit={
                      reduce
                        ? { opacity: 0 }
                        : {
                            opacity: 0,
                            y: -4,
                          }
                    }
                    transition={
                      reduce
                        ? { duration: 0 }
                        : {
                            duration: 0.2,
                            ease: EASE,
                          }
                    }
                    className="flex flex-wrap items-center gap-2"
                  >
                    <motion.button
                      type="button"
                      disabled
                      whileTap={
                        reduce ? undefined : { scale: 0.97 }
                      }
                      className={cn(
                        pillPrimary,
                        "opacity-40",
                      )}
                    >
                      <MessageCircle className="h-4 w-4" />
                      Message
                    </motion.button>
                    {isBlockedByMe ? (
                      <motion.button
                        type="button"
                        onClick={handleUnblock}
                        disabled={busy === "unblock"}
                        whileTap={
                          reduce
                            ? undefined
                            : { scale: 0.97 }
                        }
                        whileHover={
                          reduce
                            ? undefined
                            : { scale: 1.02 }
                        }
                        className={pillSecondary}
                      >
                        <ShieldBan className="h-4 w-4" />
                        {busy === "unblock"
                          ? "\u2026"
                          : "Unblock"}
                      </motion.button>
                    ) : (
                      <span className="text-[12px] text-[var(--ink-muted)]">
                        Messaging disabled while blocked
                      </span>
                    )}
                  </motion.div>
                ) : rel === "friends" ? (
                  <motion.div
                    key="friends-actions"
                    initial={
                      reduce
                        ? { opacity: 0 }
                        : {
                            opacity: 0,
                            y: 4,
                          }
                    }
                    animate={{ opacity: 1, y: 0 }}
                    exit={
                      reduce
                        ? { opacity: 0 }
                        : {
                            opacity: 0,
                            y: -4,
                          }
                    }
                    transition={
                      reduce
                        ? { duration: 0 }
                        : {
                            duration: 0.2,
                            ease: EASE,
                          }
                    }
                    className="flex flex-wrap items-center gap-2"
                  >
                    <motion.button
                      type="button"
                      onClick={handleMessage}
                      disabled={busy === "message"}
                      whileTap={
                        reduce
                          ? undefined
                          : { scale: 0.97 }
                      }
                      whileHover={
                        reduce
                          ? undefined
                          : { scale: 1.02 }
                      }
                      className={pillPrimary}
                    >
                      <MessageCircle className="h-4 w-4" />
                      {busy === "message"
                        ? "Opening\u2026"
                        : "Message"}
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={handleUnfriend}
                      disabled={busy === "unfriend"}
                      whileTap={
                        reduce
                          ? undefined
                          : { scale: 0.97 }
                      }
                      whileHover={
                        reduce
                          ? undefined
                          : { scale: 1.02 }
                      }
                      className={pillGhost}
                    >
                      <UserMinus className="h-4 w-4" />
                      {busy === "unfriend"
                        ? "\u2026"
                        : "Unfriend"}
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={handleBlock}
                      disabled={busy === "block"}
                      whileTap={
                        reduce
                          ? undefined
                          : { scale: 0.97 }
                      }
                      whileHover={
                        reduce
                          ? undefined
                          : { scale: 1.02 }
                      }
                      className={pillGhost}
                    >
                      <Ban className="h-4 w-4" />
                      Block
                    </motion.button>
                  </motion.div>
                ) : rel === "outgoing" ? (
                  <motion.div
                    key="outgoing-actions"
                    initial={
                      reduce
                        ? { opacity: 0 }
                        : {
                            opacity: 0,
                            y: 4,
                          }
                    }
                    animate={{ opacity: 1, y: 0 }}
                    exit={
                      reduce
                        ? { opacity: 0 }
                        : {
                            opacity: 0,
                            y: -4,
                          }
                    }
                    transition={
                      reduce
                        ? { duration: 0 }
                        : {
                            duration: 0.2,
                            ease: EASE,
                          }
                    }
                    className="flex flex-wrap items-center gap-2"
                  >
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface-1)] px-4 py-2 text-[13px] text-[var(--ink-muted)]">
                      Request sent
                    </span>
                    <motion.button
                      type="button"
                      onClick={handleBlock}
                      disabled={busy === "block"}
                      whileTap={
                        reduce
                          ? undefined
                          : { scale: 0.97 }
                      }
                      whileHover={
                        reduce
                          ? undefined
                          : { scale: 1.02 }
                      }
                      className={pillGhost}
                    >
                      <Ban className="h-4 w-4" />
                      Block
                    </motion.button>
                  </motion.div>
                ) : rel === "incoming" ? (
                  <motion.div
                    key="incoming-actions"
                    initial={
                      reduce
                        ? { opacity: 0 }
                        : {
                            opacity: 0,
                            y: 4,
                          }
                    }
                    animate={{ opacity: 1, y: 0 }}
                    exit={
                      reduce
                        ? { opacity: 0 }
                        : {
                            opacity: 0,
                            y: -4,
                          }
                    }
                    transition={
                      reduce
                        ? { duration: 0 }
                        : {
                            duration: 0.2,
                            ease: EASE,
                          }
                    }
                    className="flex flex-wrap items-center gap-2"
                  >
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface-1)] px-4 py-2 text-[13px] text-[var(--ink-muted)]">
                      Request pending &mdash; check Friends
                    </span>
                    <motion.button
                      type="button"
                      onClick={handleBlock}
                      disabled={busy === "block"}
                      whileTap={
                        reduce
                          ? undefined
                          : { scale: 0.97 }
                      }
                      whileHover={
                        reduce
                          ? undefined
                          : { scale: 1.02 }
                      }
                      className={pillGhost}
                    >
                      <Ban className="h-4 w-4" />
                      Block
                    </motion.button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="none-actions"
                    initial={
                      reduce
                        ? { opacity: 0 }
                        : {
                            opacity: 0,
                            y: 4,
                          }
                    }
                    animate={{ opacity: 1, y: 0 }}
                    exit={
                      reduce
                        ? { opacity: 0 }
                        : {
                            opacity: 0,
                            y: -4,
                          }
                    }
                    transition={
                      reduce
                        ? { duration: 0 }
                        : {
                            duration: 0.2,
                            ease: EASE,
                          }
                    }
                    className="flex flex-wrap items-center gap-2"
                  >
                    <motion.button
                      type="button"
                      onClick={handleAddFriend}
                      disabled={busy === "add"}
                      whileTap={
                        reduce
                          ? undefined
                          : { scale: 0.97 }
                      }
                      whileHover={
                        reduce
                          ? undefined
                          : { scale: 1.02 }
                      }
                      className={pillPrimary}
                    >
                      <UserPlus className="h-4 w-4" />
                      {busy === "add"
                        ? "Sending\u2026"
                        : "Add Friend"}
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={handleMessage}
                      disabled={busy === "message"}
                      whileTap={
                        reduce
                          ? undefined
                          : { scale: 0.97 }
                      }
                      whileHover={
                        reduce
                          ? undefined
                          : { scale: 1.02 }
                      }
                      className={pillSecondary}
                    >
                      <MessageCircle className="h-4 w-4" />
                      Message
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={handleBlock}
                      disabled={busy === "block"}
                      whileTap={
                        reduce
                          ? undefined
                          : { scale: 0.97 }
                      }
                      whileHover={
                        reduce
                          ? undefined
                          : { scale: 1.02 }
                      }
                      className={pillGhost}
                    >
                      <Ban className="h-4 w-4" />
                      Block
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
          {isSelf && (
            <motion.p
              variants={item}
              className="mt-5 text-[12px] text-[var(--ink-muted)]"
            >
              This is your profile.
            </motion.p>
          )}

          {/* ── GitHub contribution graph ────────────────────────────────── */}
          {profile.githubUsername && (
            <motion.div variants={item} className="mt-5">
              <div className="border-t border-[var(--hairline-soft)] pt-5">
                <ContributionGraph
                  username={profile.githubUsername}
                  className="text-[var(--ink-muted)]"
                >
                  <ContributionGraphCalendar className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-1)] p-3">
                    {({ activity, dayIndex, weekIndex }) => (
                      <ContributionGraphBlock
                        activity={activity}
                        dayIndex={dayIndex}
                        weekIndex={weekIndex}
                      />
                    )}
                  </ContributionGraphCalendar>
                  <ContributionGraphFooter className="mt-2">
                    <ContributionGraphTotalCount className="text-[12px] text-[var(--ink-muted)]" />
                    <ContributionGraphLegend />
                  </ContributionGraphFooter>
                </ContributionGraph>
              </div>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default ProfileContent;
