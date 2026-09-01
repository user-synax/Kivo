"use client";

import { Ban, CalendarDays, MessageCircle, ShieldBan, UserMinus, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/dashboard/avatar";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1];

function formatJoined(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(d);
  } catch {
    return null;
  }
}

/* pill bases — Framer: white pill primary, charcoal secondary, hairline ghost */
const pillPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--ink)] px-4 py-2 text-[13px] font-medium text-[var(--inverse-ink)] transition-[filter,opacity,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:brightness-[0.94] active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none";
const pillSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface-1)] px-4 py-2 text-[13px] font-medium text-[var(--ink)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--surface-2)] disabled:opacity-40 disabled:pointer-events-none";
const pillGhost =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--hairline)] px-4 py-2 text-[13px] font-medium text-[var(--ink-muted)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--surface-1)] hover:text-[var(--ink)] disabled:opacity-40";
const pillDestructive =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-4 py-2 text-[13px] font-medium text-[var(--destructive)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--destructive)]/15 disabled:opacity-40";

export function ProfileContent({ username, profile: profileProp = null, onMessage, onClose, variant = "default" }) {
  const router = useRouter();
  const [profile, setProfile] = useState(profileProp);
  const [loading, setLoading] = useState(!profileProp);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // 'add' | 'block' | 'unblock' | 'unfriend' | 'message'
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
    apiGet(`/api/v1/users/${encodeURIComponent(username)}/profile`)
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

  // keep rel in sync if profileProp changes externally
  useEffect(() => {
    if (profileProp?.relationship) setRel(profileProp.relationship);
  }, [profileProp?.relationship]);

  const name = profile?.displayName || profile?.username || username || "—";
  const handle = profile?.username ? `@${profile.username}` : username ? `@${username}` : "";
  const joined = formatJoined(profile?.joinedAt);
  const isSelf = rel === "self" || getSession()?.username === profile?.username;
  const isBlockedByMe = Boolean(profile?.isBlockedByMe);
  const isBlockedByOther = Boolean(profile?.isBlockedByOther);
  const isBlocked = isBlockedByMe || isBlockedByOther;

  const handleAddFriend = async () => {
    if (!profile?.username || busy) return;
    setBusy("add");
    try {
      await apiPost("/api/v1/friends/request", { identifier: profile.username });
      setRel("outgoing");
      setProfile((p) => (p ? { ...p, relationship: "outgoing" } : p));
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
      const conv = await apiPost("/api/v1/conversations", { participantId: profile.id });
      if (onMessage) {
        onMessage(conv);
      } else {
        // standalone page: go to app and let dashboard pick it up; persist selection
        try {
          localStorage.setItem("kivo:selected-conversation", conv.id);
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
    if (!window.confirm(`Block ${name}? You won't see their messages.`)) return;
    setBusy("block");
    try {
      await apiPost(`/api/v1/users/${profile.id}/block`, {});
      setProfile((p) => (p ? { ...p, isBlockedByMe: true, relationship: "none" } : p));
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
      setProfile((p) => (p ? { ...p, isBlockedByMe: false } : p));
    } catch (e) {
      window.alert(e?.message || "Could not unblock user");
    } finally {
      setBusy(null);
    }
  };

  const handleUnfriend = async () => {
    if (!profile?.id || busy) return;
    if (!window.confirm(`Remove ${name} from friends?`)) return;
    setBusy("unfriend");
    try {
      await apiDelete(`/api/v1/friends/${profile.id}`);
      setRel("none");
      setProfile((p) => (p ? { ...p, relationship: "none" } : p));
    } catch (e) {
      window.alert(e?.message || "Could not remove friend");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className={cn("w-full overflow-hidden", isDrawer ? "bg-[var(--canvas)]" : "bg-[var(--canvas)]")}>
        <div className="h-[132px] w-full animate-pulse bg-[var(--surface-1)] sm:h-[160px]" />
        <div className="px-5 py-6 sm:px-6">
          <div className="flex gap-4">
            <div className="size-20 animate-pulse rounded-2xl bg-[var(--surface-1)] sm:size-24" />
            <div className="flex-1 space-y-3 pt-1">
              <div className="h-5 w-32 animate-pulse rounded bg-[var(--surface-1)]" />
              <div className="h-3 w-20 animate-pulse rounded bg-[var(--surface-1)]" />
            </div>
          </div>
          <div className="mt-5 h-12 animate-pulse rounded-xl bg-[var(--surface-1)]" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="px-6 py-10 text-center">
        <p className="text-sm text-[var(--ink-muted)]">{error || "Profile not found."}</p>
        {onClose && (
          <button type="button" onClick={onClose} className={cn(pillSecondary, "mt-4")}>
            Close
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex w-full flex-col overflow-hidden bg-[var(--canvas)]", isDrawer && "rounded-t-[20px]")}>
      {/* Banner — full-bleed atmospheric, not a card */}
      <div className="relative h-[132px] w-full shrink-0 overflow-hidden border-b border-[var(--hairline)] bg-[var(--surface-1)] sm:h-[160px]">
        {profile.banner ? (
          <img src={profile.banner} alt="" aria-hidden="true" className="h-full w-full object-cover" />
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
        {/* subtle hairline vignette so banner feels like canvas, not a poster card */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" aria-hidden="true" />
        {isDrawer && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full border border-white/10 bg-black/30 text-white backdrop-blur-md transition-colors hover:bg-black/45"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Identity — avatar overlaps banner with a canvas-colored ring */}
      <div className="px-5 pb-6 pt-0 sm:px-6">
        <div className="flex items-end gap-4">
          <span className="-mt-8 inline-block rounded-2xl bg-[var(--canvas)] p-1 sm:-mt-10">
            <span className="inline-block rounded-xl p-[2px]" style={{ background: "var(--hairline)" }}>
              <Avatar name={name} avatarStyle={profile.avatarStyle} url={profile.avatarUrl} size="lg" />
            </span>
          </span>
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="truncate font-display text-[22px] font-semibold tracking-tight text-[var(--ink)] sm:text-[24px]">{name}</h1>
            <p className="truncate text-[13px] text-[var(--ink-muted)]">{handle}</p>
          </div>
        </div>

        {/* Status line if present */}
        {profile.status && <p className="mt-3 text-sm italic text-[var(--ink-muted)]">“{profile.status}”</p>}

        {/* Bio — editorial, left-accent hairline, not a card */}
        {profile.bio ? (
          <p className="mt-4 border-l border-[var(--hairline)] pl-3 text-sm leading-relaxed text-[var(--ink)]/90">{profile.bio}</p>
        ) : (
          <p className="mt-4 text-sm text-[var(--ink-muted)]/70">No bio yet.</p>
        )}

        {/* Meta row */}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--hairline-soft)] pt-4 text-[12px] text-[var(--ink-muted)]">
          {joined && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Joined {joined}
            </span>
          )}
          {rel === "friends" && <span className="inline-flex items-center gap-1.5">• Friends</span>}
          {rel === "outgoing" && <span className="inline-flex items-center gap-1.5">• Request sent</span>}
          {rel === "incoming" && <span className="inline-flex items-center gap-1.5">• Request received</span>}
        </div>

        {/* Block banner — reuses chat-panel destructive pattern */}
        {isBlockedByOther && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-4 py-3 text-sm text-[var(--destructive)]">
            <Ban className="h-4 w-4 shrink-0" />
            <span>{name} blocked you</span>
          </div>
        )}
        {isBlockedByMe && !isBlockedByOther && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface-1)] px-4 py-3 text-sm text-[var(--ink-muted)]">
            <span className="flex items-center gap-2">
              <Ban className="h-4 w-4 shrink-0" />
              You blocked {name}
            </span>
            <button
              type="button"
              onClick={handleUnblock}
              disabled={busy === "unblock"}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--ink)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--inverse-ink)] hover:brightness-95 disabled:opacity-40"
            >
              Unblock
            </button>
          </div>
        )}

        {/* Actions — pill row; no second card, just a quiet rule above */}
        {!isSelf && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {isBlocked ? (
              <>
                <button type="button" disabled className={cn(pillPrimary, "opacity-40")}>
                  <MessageCircle className="h-4 w-4" />
                  Message
                </button>
                {isBlockedByMe ? (
                  <button type="button" onClick={handleUnblock} disabled={busy === "unblock"} className={pillSecondary}>
                    <ShieldBan className="h-4 w-4" />
                    {busy === "unblock" ? "…" : "Unblock"}
                  </button>
                ) : (
                  <span className="text-[12px] text-[var(--ink-muted)]">Messaging disabled while blocked</span>
                )}
              </>
            ) : rel === "friends" ? (
              <>
                <button type="button" onClick={handleMessage} disabled={busy === "message"} className={pillPrimary}>
                  <MessageCircle className="h-4 w-4" />
                  {busy === "message" ? "Opening…" : "Message"}
                </button>
                <button type="button" onClick={handleUnfriend} disabled={busy === "unfriend"} className={pillGhost}>
                  <UserMinus className="h-4 w-4" />
                  {busy === "unfriend" ? "…" : "Unfriend"}
                </button>
                <button type="button" onClick={handleBlock} disabled={busy === "block"} className={pillGhost}>
                  <Ban className="h-4 w-4" />
                  Block
                </button>
              </>
            ) : rel === "outgoing" ? (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface-1)] px-4 py-2 text-[13px] text-[var(--ink-muted)]">Request sent</span>
                <button type="button" onClick={handleBlock} disabled={busy === "block"} className={pillGhost}>
                  <Ban className="h-4 w-4" />
                  Block
                </button>
              </>
            ) : rel === "incoming" ? (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface-1)] px-4 py-2 text-[13px] text-[var(--ink-muted)]">Request pending — check Friends</span>
                <button type="button" onClick={handleBlock} disabled={busy === "block"} className={pillGhost}>
                  <Ban className="h-4 w-4" />
                  Block
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={handleAddFriend} disabled={busy === "add"} className={pillPrimary}>
                  <UserPlus className="h-4 w-4" />
                  {busy === "add" ? "Sending…" : "Add Friend"}
                </button>
                <button type="button" onClick={handleMessage} disabled={busy === "message"} className={pillSecondary}>
                  <MessageCircle className="h-4 w-4" />
                  Message
                </button>
                <button type="button" onClick={handleBlock} disabled={busy === "block"} className={pillGhost}>
                  <Ban className="h-4 w-4" />
                  Block
                </button>
              </>
            )}
          </div>
        )}
        {isSelf && <p className="mt-5 text-[12px] text-[var(--ink-muted)]">This is your profile.</p>}
      </div>
    </div>
  );
}

export default ProfileContent;
