"use client";

import { Check, Crown, Loader2, Trash2, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/dashboard/avatar";
import { CountryPicker } from "@/components/profile/country-picker";
import { apiDelete, apiPatch, apiUpload } from "@/lib/api";
import { getSession, getToken, setSession } from "@/lib/auth";
import { AVATAR_STYLES } from "@/lib/avatar-styles";
import { BANNER_OPTIONS } from "@/lib/banners";
import { COUNTRIES } from "@/lib/countries";
import {
  effectAvatarClass,
  effectNameClass,
  PROFILE_EFFECTS,
} from "@/lib/profile-effects";

const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]";

// Curated status emoji — a tight set that reads well as a small chip next to
// the status line (kept separate from the chat reaction emoji pool).
const STATUS_EMOJIS = [
  "😀", "😎", "🥳", "🤩", "😴", "🤗", "🤔", "😅",
  "🎮", "🎧", "🎬", "🎨", "📚", "💼", "🏋️", "🧘",
  "🏃", "🚀", "☕", "🍜", "💻", "📱", "🎵", "🎸",
  "✈️", "🌍", "🏝️", "🌙", "☀️", "⚡", "🔥", "💡",
];

// One-tap vibe presets — set emoji + status text together (Discord/WhatsApp
// style "mood" chips shown under the status input).
const VIBE_PRESETS = [
  { label: "Gaming", emoji: "🎮", status: "gaming" },
  { label: "Vibing", emoji: "🎧", status: "vibing" },
  { label: "Away", emoji: "😴", status: "away" },
  { label: "Studying", emoji: "📚", status: "studying" },
  { label: "Working", emoji: "💼", status: "working" },
  { label: "Sleepy", emoji: "🌙", status: "sleepy" },
];

function Field({ label, hint, counter, children }) {
    return (
        <div className="block">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="text-[12px] font-medium text-[var(--text-muted)]">
                    {label}
                </span>
                {counter}
            </div>
            {children}
            {hint && (
                <span className="mt-1 block text-[11px] leading-snug text-[var(--text-muted)]">
                    {hint}
                </span>
            )}
        </div>
    );
}

function Section({ label, delay = 0, className = "", children }) {
    return (
        <section
            className={`t-item-in ${className}`}
            style={{ animationDelay: `${delay}ms` }}
        >
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                {label}
            </h3>
            <div className="space-y-4">{children}</div>
        </section>
    );
}

const inputCls = `w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] caret-[var(--accent)] placeholder:text-[var(--text-muted)]/70 outline-none transition-[border-color,box-shadow] duration-200 ${EASE} focus:border-[var(--accent)] focus:ring-[3px] focus:ring-[var(--accent)]/15 hover:border-[var(--text-muted)]/40`;

// Small live character counter — only appears once the user is close to the
// limit so fields stay visually calm until it matters.
function Counter({ value, max }) {
    if (value.length <= max * 0.7) return null;
    const near = value.length >= max;
    return (
        <span
            className={`text-[11px] tabular-nums transition-colors duration-200 ${EASE} ${
                near ? "text-[#ff5577]" : "text-[var(--text-muted)]"
            }`}
        >
            {value.length}/{max}
        </span>
    );
}

export function ProfileEditModal({ open, currentUser, onClose, onSaved }) {
    const router = useRouter();
    const [render, setRender] = useState(open);
    const [shown, setShown] = useState(false);

    const [displayName, setDisplayName] = useState("");
    const [username, setUsername] = useState("");
    const [bio, setBio] = useState("");
    const [status, setStatus] = useState("");
    const [statusEmoji, setStatusEmoji] = useState("");
    const [showStatusEmojis, setShowStatusEmojis] = useState(false);
    const [avatarStyle, setAvatarStyle] = useState("default");
    const [profileEffect, setProfileEffect] = useState("none");
    const [banner, setBanner] = useState("");
    const [country, setCountry] = useState(null);
    const [githubUsername, setGithubUsername] = useState("");
    const [xUsername, setXUsername] = useState("");
    const [instagramUsername, setInstagramUsername] = useState("");
    const [youtubeUrl, setYoutubeUrl] = useState("");
    const [websiteUrl, setWebsiteUrl] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    // Avatar / DP upload.
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const fileRef = useRef(null);

    // Custom banner upload (Kivo Plus).
    const [bannerUploading, setBannerUploading] = useState(false);
    const bannerFileRef = useRef(null);

    const isPlus = (currentUser || getSession())?.plan === "plus";

    const handleBannerUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            setError("Please choose an image file.");
            return;
        }
        if (file.size > 8 * 1024 * 1024) {
            setError("Image must be under 8MB.");
            return;
        }
        setError(null);
        setBannerUploading(true);
        try {
            const form = new FormData();
            form.append("banner", file);
            const updated = await apiUpload(
                "/api/v1/users/me/banner",
                form,
            );
            setSession(updated, getToken());
            onSaved?.(updated);
            setBanner(updated.banner || "");
        } catch (err) {
            setError(
                err?.message || "Could not upload custom banner",
            );
        } finally {
            setBannerUploading(false);
            if (bannerFileRef.current) bannerFileRef.current.value = "";
        }
    };

    const handleAvatarChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            setError("Please choose an image file.");
            return;
        }
        if (file.size > 4 * 1024 * 1024) {
            setError("Image must be under 4MB.");
            return;
        }
        setError(null);
        setUploading(true);
        try {
            const form = new FormData();
            form.append("avatar", file);
            const updated = await apiUpload("/api/v1/users/me/avatar", form);
            // Persist + propagate (drives sidebar/profile/chat avatars everywhere).
            setSession(updated, getToken());
            onSaved?.(updated);
            setPreviewUrl(null);
        } catch (err) {
            setError(err?.message || "Could not upload photo");
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    const handleRemoveAvatar = async () => {
        setError(null);
        setUploading(true);
        try {
            const updated = await apiDelete("/api/v1/users/me/avatar");
            setSession(updated, getToken());
            onSaved?.(updated);
            setPreviewUrl(null);
        } catch (err) {
            setError(err?.message || "Could not remove photo");
        } finally {
            setUploading(false);
        }
    };

    // Mount/unmount with a one-frame delay so the open/close transitions play.
    useEffect(() => {
        if (open) {
            const me = currentUser || getSession();
            setDisplayName(me?.displayName || "");
            setUsername(me?.username || "");
            setBio(me?.bio || "");
            setStatus(me?.status || "");
            setStatusEmoji(me?.statusEmoji || "");
            setAvatarStyle(me?.avatarStyle || "default");
            setProfileEffect(me?.profileEffect || "none");
            setBanner(me?.banner || "");
            setCountry(
                me?.country
                    ? COUNTRIES.find((c) => c.code === me.country) || null
                    : null,
            );
            setGithubUsername(me?.githubUsername || "");
            setXUsername(me?.xUsername || "");
            setInstagramUsername(me?.instagramUsername || "");
            setYoutubeUrl(me?.youtubeUrl || "");
            setWebsiteUrl(me?.websiteUrl || "");
            setError(null);
            setRender(true);
            const id = requestAnimationFrame(() => setShown(true));
            return () => cancelAnimationFrame(id);
        }
        setShown(false);
        const t = setTimeout(() => setRender(false), 160);
        return () => clearTimeout(t);
    }, [open, currentUser]);

    // Escape to close.
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!render) return null;

    const close = () => onClose();

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            const updated = await apiPatch("/api/v1/users/me", {
                displayName: displayName.trim(),
                username: username.trim(),
                bio: bio.trim(),
                status: status.trim(),
                statusEmoji: statusEmoji.trim(),
                avatarStyle,
                profileEffect,
                banner,
                country: country?.code || "",
                githubUsername: githubUsername.trim(),
                xUsername: xUsername.trim(),
                instagramUsername: instagramUsername.trim(),
                youtubeUrl: youtubeUrl.trim(),
                websiteUrl: websiteUrl.trim(),
            });
            // Persist the refreshed user object (drives the sidebar avatar + session).
            setSession(updated, getToken());
            onSaved?.(updated);
            onClose();
        } catch (err) {
            setError(err?.message || "Could not save changes");
        } finally {
            setSaving(false);
        }
    };

    const openFullProfile = () => {
        onClose();
        router.push("/u/" + (username || currentUser?.username));
    };

    const avatarNode = (size) => (
        <Avatar
            name={displayName || currentUser?.displayName || "?"}
            avatarStyle={avatarStyle}
            url={previewUrl || currentUser?.avatarUrl}
            size={size}
        />
    );

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
            <div
                className={`t-modal-backdrop absolute inset-0 bg-black/60 backdrop-blur-[2px] ${
                    shown ? "is-open" : ""
                }`}
                onClick={close}
                aria-hidden="true"
            />
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Edit profile"
                className={`t-modal relative z-10 flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-[0_24px_80px_-16px_rgba(0,0,0,0.6)] sm:max-h-[86vh] sm:max-w-lg sm:rounded-2xl ${
                    shown ? "is-open" : ""
                }`}
            >
                {/* ── Cover header: live banner preview + overlapping avatar ─────── */}
                <div className="relative shrink-0">
                    <div className="relative h-24 w-full overflow-hidden sm:h-28">
                        {banner ? (
                            <img
                                src={banner}
                                alt=""
                                aria-hidden="true"
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <div className="h-full w-full bg-gradient-to-br from-[var(--accent-blue)]/40 to-[#6a4cf5]/40" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/10" />
                    </div>

                    {/* Mobile drag handle */}
                    <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center pt-2 sm:hidden">
                        <span className="h-1 w-9 rounded-full bg-white/60" />
                    </div>

                    <button
                        type="button"
                        onClick={close}
                        aria-label="Close"
                        className={`absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-black/40 text-white/90 backdrop-blur-sm transition-[background-color,transform] duration-200 ${EASE} hover:bg-black/60 active:scale-90`}
                    >
                        <X className="h-4 w-4" />
                    </button>

                    {/* Avatar + name overlapping the cover */}
                    <div className="relative flex items-end gap-3 px-5 pb-3">
                        <div className="relative -mt-10 shrink-0 rounded-2xl ring-4 ring-[var(--bg-surface)] sm:-mt-12">
                            {avatarNode("lg")}
                            {uploading && (
                                <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/45 text-white">
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                </span>
                            )}
                        </div>
                        <div className="min-w-0 flex-1 pb-0.5">
                            <p
                                className={`truncate text-[15px] font-semibold leading-tight text-[var(--text-primary)] ${
                                    effectNameClass(profileEffect) || ""
                                }`}
                            >
                                {displayName ||
                                    currentUser?.displayName ||
                                    "Profile"}
                            </p>
                            <p className="truncate text-[12px] text-[var(--text-muted)]">
                                {username
                                    ? `@${username}`
                                    : "Set up your identity"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Body ────────────────────────────────────────────────────────── */}
                <div className="min-h-0 flex-1 space-y-7 overflow-y-auto overscroll-contain px-5 py-5">
                    <Section label="Identity" delay={0}>
                        <Field
                            label="Display name"
                            counter={<Counter value={displayName} max={50} />}
                        >
                            <input
                                className={inputCls}
                                value={displayName}
                                maxLength={50}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Your name"
                            />
                        </Field>

                        <Field
                            label="Username"
                            hint="Letters, numbers and underscores."
                            counter={<Counter value={username} max={30} />}
                        >
                            <input
                                className={inputCls}
                                value={username}
                                maxLength={30}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="username"
                                spellCheck={false}
                                autoComplete="off"
                            />
                        </Field>

                        <Field
                            label="Status"
                            hint="An emoji chip + short line shown under your name."
                            counter={<Counter value={status} max={60} />}
                        >
                            <div className="flex items-stretch gap-2">
                                {/* Emoji chip button — mirrors the profile-page
                                    rendering so the preview matches. */}
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowStatusEmojis((v) => !v)
                                    }
                                    aria-label="Pick a status emoji"
                                    aria-pressed={showStatusEmojis}
                                    title="Pick an emoji"
                                    className={`flex h-[42px] w-[46px] shrink-0 items-center justify-center rounded-xl border text-lg transition-[border-color,background-color] duration-200 ${EASE} ${
                                        statusEmoji
                                            ? "border-[var(--accent)] bg-[var(--hover)]"
                                            : "border-[var(--border)] bg-[var(--bg-base)]"
                                    }`}
                                >
                                    {statusEmoji || "😊"}
                                </button>
                                <input
                                    className={`${inputCls} flex-1`}
                                    value={status}
                                    maxLength={60}
                                    onChange={(e) =>
                                        setStatus(e.target.value)
                                    }
                                    placeholder="e.g. Available"
                                />
                            </div>

                            {showStatusEmojis && (
                                <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-2">
                                    <div className="grid grid-cols-8 gap-1">
                                        {STATUS_EMOJIS.map((e) => (
                                            <button
                                                key={e}
                                                type="button"
                                                onClick={() => {
                                                    setStatusEmoji(e);
                                                    setShowStatusEmojis(false);
                                                }}
                                                aria-label={`Status emoji ${e}`}
                                                className={`flex aspect-square items-center justify-center rounded-lg text-lg transition-colors duration-100 ${
                                                    statusEmoji === e
                                                        ? "bg-[var(--accent)]/20 ring-1 ring-[var(--accent)]"
                                                        : "hover:bg-[var(--hover)]"
                                                }`}
                                            >
                                                {e}
                                            </button>
                                        ))}
                                    </div>
                                    {statusEmoji && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setStatusEmoji("");
                                                setShowStatusEmojis(false);
                                            }}
                                            className="mt-1.5 w-full rounded-lg px-2 py-1 text-left text-[11px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
                                        >
                                            Clear emoji
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Vibe presets — one tap sets emoji + status text. */}
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {VIBE_PRESETS.map((v) => {
                                    const active =
                                        status === v.status &&
                                        statusEmoji === v.emoji;
                                    return (
                                        <button
                                            key={v.label}
                                            type="button"
                                            onClick={() => {
                                                setStatusEmoji(v.emoji);
                                                setStatus(v.status);
                                            }}
                                            aria-pressed={active}
                                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-[border-color,background-color] duration-150 ${EASE} ${
                                                active
                                                    ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text-primary)]"
                                                    : "border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                            }`}
                                        >
                                            <span className="text-[13px] leading-none">
                                                {v.emoji}
                                            </span>
                                            {v.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </Field>

                        <Field
                            label="Bio"
                            counter={<Counter value={bio} max={280} />}
                        >
                            <textarea
                                className={`${inputCls} min-h-[84px] resize-none`}
                                value={bio}
                                maxLength={280}
                                onChange={(e) => setBio(e.target.value)}
                                placeholder="A little about you"
                            />
                        </Field>
                    </Section>

                    <Section label="Presence" delay={40}>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field
                                label="Country"
                                hint="A flag on your profile."
                            >
                                <CountryPicker
                                    value={country}
                                    onChange={setCountry}
                                />
                            </Field>
                        </div>
                    </Section>

                    <Section label="Links" delay={60}>
                        <p className="-mt-1 text-[11px] leading-snug text-[var(--text-muted)]">
                            Handles and sites shown as icon chips on your
                            profile. GitHub also powers your contribution
                            graph.
                        </p>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field
                                label="GitHub"
                                hint="Shows your contribution graph."
                            >
                                <div className="flex items-stretch gap-2">
                                    <span className="flex shrink-0 items-center rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-2.5 text-[13px] text-[var(--text-muted)]">
                                        @
                                    </span>
                                    <input
                                        className={`${inputCls} flex-1 px-3`}
                                        value={githubUsername}
                                        maxLength={39}
                                        onChange={(e) =>
                                            setGithubUsername(e.target.value)
                                        }
                                        placeholder="username"
                                        spellCheck={false}
                                        autoComplete="off"
                                    />
                                </div>
                            </Field>
                            <Field label="X (Twitter)" hint="Username, no @.">
                                <div className="flex items-stretch gap-2">
                                    <span className="flex shrink-0 items-center rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-2.5 text-[13px] text-[var(--text-muted)]">
                                        @
                                    </span>
                                    <input
                                        className={`${inputCls} flex-1 px-3`}
                                        value={xUsername}
                                        maxLength={60}
                                        onChange={(e) =>
                                            setXUsername(e.target.value)
                                        }
                                        placeholder="username"
                                        spellCheck={false}
                                        autoComplete="off"
                                    />
                                </div>
                            </Field>
                            <Field
                                label="Instagram"
                                hint="Username, no @."
                            >
                                <div className="flex items-stretch gap-2">
                                    <span className="flex shrink-0 items-center rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-2.5 text-[13px] text-[var(--text-muted)]">
                                        @
                                    </span>
                                    <input
                                        className={`${inputCls} flex-1 px-3`}
                                        value={instagramUsername}
                                        maxLength={60}
                                        onChange={(e) =>
                                            setInstagramUsername(
                                                e.target.value,
                                            )
                                        }
                                        placeholder="username"
                                        spellCheck={false}
                                        autoComplete="off"
                                    />
                                </div>
                            </Field>
                            <Field
                                label="YouTube"
                                hint="Full channel link."
                            >
                                <input
                                    className={inputCls}
                                    value={youtubeUrl}
                                    maxLength={500}
                                    onChange={(e) =>
                                        setYoutubeUrl(e.target.value)
                                    }
                                    placeholder="https://youtube.com/@channel"
                                    spellCheck={false}
                                    autoComplete="off"
                                />
                            </Field>
                            <Field
                                label="Website"
                                hint="Full link (https://…)."
                            >
                                <input
                                    className={inputCls}
                                    value={websiteUrl}
                                    maxLength={500}
                                    onChange={(e) =>
                                        setWebsiteUrl(e.target.value)
                                    }
                                    placeholder="https://example.com"
                                    spellCheck={false}
                                    autoComplete="off"
                                />
                            </Field>
                        </div>
                    </Section>

                    <Section label="Profile photo" delay={80}>
                        <div className="flex flex-wrap items-center gap-3">
                            <input
                                ref={fileRef}
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/gif"
                                onChange={handleAvatarChange}
                                className="hidden"
                            />
                            <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                disabled={uploading}
                                className={`group relative flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-4 text-[13px] font-medium text-[var(--text-primary)] transition-[border-color,background-color,transform] duration-200 ${EASE} hover:border-[var(--accent)] hover:bg-[var(--hover)] active:scale-[0.98] disabled:opacity-50`}
                            >
                                <Upload
                                    className={`h-3.5 w-3.5 text-[var(--text-muted)] transition-colors duration-200 ${EASE} group-hover:text-[var(--accent)]`}
                                />
                                {uploading
                                    ? "Uploading…"
                                    : currentUser?.avatarUrl
                                      ? "Change photo"
                                      : "Upload photo"}
                            </button>
                            {currentUser?.avatarUrl ? (
                                <button
                                    type="button"
                                    onClick={handleRemoveAvatar}
                                    disabled={uploading}
                                    className={`flex h-11 items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium text-[var(--text-muted)] transition-[color,transform] duration-200 ${EASE} hover:text-[#ff5577] active:scale-[0.98] disabled:opacity-50`}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Remove
                                </button>
                            ) : null}
                            <span className="w-full text-[11px] leading-snug text-[var(--text-muted)]">
                                JPG, PNG, WebP or GIF · up to 4MB
                            </span>
                        </div>

                        {/* Avatar style presets */}
                        <div>
                            <span className="mb-2 block text-[12px] text-[var(--text-muted)]">
                                Border style
                            </span>
                            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                                {AVATAR_STYLES.map((preset) => {
                                    const active = preset.id === avatarStyle;
                                    return (
                                        <button
                                            key={preset.id}
                                            type="button"
                                            onClick={() =>
                                                setAvatarStyle(preset.id)
                                            }
                                            aria-pressed={active}
                                            title={preset.label}
                                            className={`group relative flex flex-col items-center gap-1.5 rounded-xl border p-2 transition-[border-color,background-color,transform] duration-200 ${EASE} active:scale-[0.95] ${
                                                active
                                                    ? "border-[var(--accent)] bg-[var(--hover)]"
                                                    : "border-[var(--border)] hover:bg-[var(--hover)]"
                                            }`}
                                        >
                                            <Avatar
                                                name={
                                                    displayName ||
                                                    currentUser?.displayName ||
                                                    "?"
                                                }
                                                avatarStyle={preset.id}
                                                size="sm"
                                            />
                                            {active && (
                                                <span className="t-badge-pop absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)] ring-2 ring-[var(--bg-surface)]">
                                                    <Check
                                                        className="h-2.5 w-2.5"
                                                        strokeWidth={3}
                                                    />
                                                </span>
                                            )}
                                            <span className="text-[10px] leading-none text-[var(--text-muted)]">
                                                {preset.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </Section>

                    <Section label="Banner" delay={120}>
                        <p className="-mt-1 text-[11px] leading-snug text-[var(--text-muted)]">
                            Animated cover shown at the top of your profile —
                            previewed live in the header above.
                        </p>
                        {isPlus ? (
                            <div className="flex flex-wrap items-center gap-3">
                                <input
                                    ref={bannerFileRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,image/gif"
                                    onChange={handleBannerUpload}
                                    className="hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        bannerFileRef.current?.click()
                                    }
                                    disabled={bannerUploading}
                                    className={`group flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3.5 text-[12px] font-medium text-[var(--text-primary)] transition-[border-color,background-color,transform] duration-200 ${EASE} hover:border-[var(--accent)] hover:bg-[var(--hover)] active:scale-[0.98] disabled:opacity-50`}
                                >
                                    <Upload
                                        className={`h-3.5 w-3.5 text-[var(--text-muted)] transition-colors duration-200 ${EASE} group-hover:text-[var(--accent)]`}
                                    />
                                    {bannerUploading
                                        ? "Uploading…"
                                        : "Upload custom banner"}
                                </button>
                                <span className="text-[11px] text-[var(--text-muted)]">
                                    GIF, JPG, PNG or WebP · up to 8MB
                                </span>
                            </div>
                        ) : (
                            <p className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                                <Crown className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                                Custom banner uploads are a Kivo Plus perk
                            </p>
                        )}
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => setBanner("")}
                                aria-pressed={!banner}
                                className={`flex h-14 items-center justify-center rounded-xl border text-[11px] font-medium transition-[border-color,background-color,transform] duration-200 ${EASE} active:scale-[0.97] ${
                                    !banner
                                        ? "border-[var(--accent)] bg-[var(--hover)] text-[var(--text-primary)]"
                                        : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover)]"
                                }`}
                            >
                                None
                            </button>
                            {BANNER_OPTIONS.map((opt) => {
                                const active = banner === opt.url;
                                return (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => setBanner(opt.url)}
                                        aria-pressed={active}
                                        aria-label={opt.label}
                                        title={opt.label}
                                        className={`relative h-14 overflow-hidden rounded-xl border transition-[border-color,box-shadow,transform] duration-200 ${EASE} active:scale-[0.97] ${
                                            active
                                                ? "border-[var(--accent)] ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-surface)]"
                                                : "border-[var(--border)] hover:brightness-110"
                                        }`}
                                    >
                                        <img
                                            src={opt.url}
                                            alt=""
                                            aria-hidden="true"
                                            className="h-full w-full object-cover"
                                        />
                                        {active && (
                                            <span className="t-badge-pop absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)] ring-2 ring-[var(--bg-surface)]">
                                                <Check
                                                    className="h-2.5 w-2.5"
                                                    strokeWidth={3}
                                                />
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </Section>

                    <Section label="Profile effects" delay={160}>
                        <p className="-mt-1 text-[11px] leading-snug text-[var(--text-muted)]">
                            Small presence flourishes everyone sees on your
                            profile. Kivo Plus perk.
                        </p>
                        {isPlus ? (
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {PROFILE_EFFECTS.map((fx) => {
                                    const active =
                                        profileEffect === fx.id;
                                    return (
                                        <button
                                            key={fx.id}
                                            type="button"
                                            onClick={() =>
                                                setProfileEffect(fx.id)
                                            }
                                            aria-pressed={active}
                                            title={fx.label}
                                            className={`group relative flex flex-col gap-1.5 rounded-xl border p-2 text-left transition-[border-color,background-color,transform] duration-200 ${EASE} active:scale-[0.95] ${
                                                active
                                                    ? "border-[var(--accent)] bg-[var(--hover)]"
                                                    : "border-[var(--border)] hover:bg-[var(--hover)]"
                                            }`}
                                        >
                                            <span className="flex items-center gap-1.5">
                                                <span
                                                    className={`rounded-lg bg-[var(--bg-base)] p-px ${
                                                        effectAvatarClass(
                                                            fx.id,
                                                        ) ||
                                                        ""
                                                    }`}
                                                >
                                                    <Avatar
                                                        name="A"
                                                        size="xs"
                                                    />
                                                </span>
                                                <span
                                                    className={`text-[11px] font-semibold leading-none text-[var(--text-primary)] ${
                                                        effectNameClass(
                                                            fx.id,
                                                        ) ||
                                                        ""
                                                    }`}
                                                >
                                                    Name
                                                </span>
                                            </span>
                                            <span className="text-[10px] font-medium leading-tight text-[var(--text-muted)]">
                                                {fx.label}
                                            </span>
                                            {active && (
                                                <span className="t-badge-pop absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)] ring-2 ring-[var(--bg-surface)]">
                                                    <Check
                                                        className="h-2.5 w-2.5"
                                                        strokeWidth={3}
                                                    />
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="flex items-center gap-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-base)] px-3 py-2.5 text-[11px] leading-snug text-[var(--text-muted)]">
                                <Crown className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                                Effects are locked on the free plan — a glow
                                around your avatar and an animated gradient
                                name unlock with Kivo Plus.
                            </p>
                        )}
                    </Section>

                    {error && (
                        <div
                            role="alert"
                            className="t-badge-pop flex items-start gap-2 rounded-xl border border-[#ff5577]/25 bg-[#ff5577]/10 px-3 py-2.5 text-[12px] leading-snug text-[#ff9ab3]"
                        >
                            <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            {error}
                        </div>
                    )}
                </div>

                {/* ── Footer (sticky, safe-area aware) ───────────────────────────── */}
                <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--bg-surface)]/95 px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] backdrop-blur">
                    <button
                        type="button"
                        onClick={openFullProfile}
                        className="rounded-lg px-1 py-1 text-[13px] text-[var(--text-muted)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-[var(--text-primary)]"
                    >
                        View Public profile
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={close}
                            disabled={saving}
                            className={`flex h-10 flex-1 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-[13px] font-medium text-[var(--text-primary)] transition-[background-color,transform] duration-200 ${EASE} hover:bg-[var(--hover)] active:scale-[0.98] disabled:opacity-50 sm:flex-none`}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-[13px] font-semibold text-[var(--on-accent)] shadow-[0_6px_20px_-8px_var(--accent)] transition-[filter,transform,opacity] duration-200 ${EASE} hover:brightness-110 active:scale-[0.98] disabled:opacity-60 sm:flex-none`}
                        >
                            {saving && (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            )}
                            {saving ? "Saving…" : "Save changes"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ProfileEditModal;
