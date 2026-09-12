"use client";

import {
    Camera,
    Check,
    Crown,
    Image as ImageIcon,
    Link2,
    Loader2,
    Sparkles,
    Trash2,
    Upload,
    User as UserIcon,
    X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { Avatar } from "@/components/dashboard/avatar";
import { CountryPicker } from "@/components/profile/country-picker";
import { apiDelete, apiPatch, apiUpload } from "@/lib/api";
import { getSession, getToken, setSession } from "@/lib/auth";
import { AVATAR_STYLES } from "@/lib/avatar-styles";
import { isPlusUser } from "@/lib/plus";
import { BANNER_OPTIONS } from "@/lib/banners";
import { COUNTRIES } from "@/lib/countries";
import {
    effectAvatarClass,
    effectNameClass,
    PROFILE_EFFECTS,
} from "@/lib/profile-effects";
import {
    USERNAME_COLOR_PRESETS,
    isValidHex,
    usernameColorClass,
    usernameColorStyle,
} from "@/lib/username-colors";

const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]";

/* ── Static data (module scope = zero re-alloc per render, fast) ─────────── */
const STATUS_EMOJIS = [
    "😀", "😎", "🥳", "🤩", "😴", "🤗", "🤔", "😅",
    "🎮", "🎧", "🎬", "🎨", "📚", "💼", "🏋️", "🧘",
    "🏃", "🚀", "☕", "🍜", "💻", "📱", "🎵", "🎸",
    "✈️", "🌍", "🏝️", "🌙", "☀️", "⚡", "🔥", "💡",
];

const VIBE_PRESETS = [
    { label: "Gaming", emoji: "🎮", status: "gaming" },
    { label: "Vibing", emoji: "🎧", status: "vibing" },
    { label: "Away", emoji: "😴", status: "away" },
    { label: "Studying", emoji: "📚", status: "studying" },
    { label: "Working", emoji: "💼", status: "working" },
    { label: "Sleepy", emoji: "🌙", status: "sleepy" },
];

const PRONOUN_OPTIONS = ["he/him", "she/her", "they/them", "he/they", "she/they", "any"];
const STATUS_EXPIRY_OPTIONS = [
    { id: "", label: "Don't clear" },
    { id: "30m", label: "30 minutes" },
    { id: "1h", label: "1 hour" },
    { id: "4h", label: "4 hours" },
    { id: "today", label: "End of today" },
];

const TABS = [
    { id: "profile", label: "Profile", icon: UserIcon },
    { id: "avatar", label: "Avatar", icon: Camera },
    { id: "style", label: "Style", icon: Sparkles },
    { id: "links", label: "Links", icon: Link2 },
];

function expiryToISO(optionId) {
    if (!optionId) return null;
    const now = Date.now();
    if (optionId === "30m") return new Date(now + 30 * 60 * 1000).toISOString();
    if (optionId === "1h") return new Date(now + 60 * 60 * 1000).toISOString();
    if (optionId === "4h") return new Date(now + 4 * 60 * 60 * 1000).toISOString();
    if (optionId === "today") {
        const d = new Date();
        d.setHours(23, 59, 59, 999);
        return d.toISOString();
    }
    return null;
}
function isoToOption(iso) {
    if (!iso) return "";
    const diff = new Date(iso).getTime() - Date.now();
    if (diff <= 0) return "";
    if (diff <= 35 * 60 * 1000) return "30m";
    if (diff <= 70 * 60 * 1000) return "1h";
    if (diff <= 5 * 60 * 60 * 1000) return "4h";
    return "today";
}

/* ── Memoized primitives (fast: isolated re-renders, transform-only motion) ─ */

const inputCls = `h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3.5 text-[16px] text-[var(--text-primary)] caret-[var(--accent)] placeholder:text-[var(--text-muted)]/70 outline-none transition-[border-color,box-shadow,background-color] duration-200 ${EASE} hover:border-[var(--text-muted)]/40 focus:border-[var(--accent)] focus:ring-[3px] focus:ring-[var(--accent)]/15 sm:text-sm`;

const Counter = memo(function Counter({ value, max }) {
    const len = value?.length || 0;
    if (len <= max * 0.7) return null;
    const near = len >= max;
    return (
        <span
            className={`text-[11px] tabular-nums transition-colors duration-200 ${EASE} ${
                near ? "text-[#ff5577]" : "text-[var(--text-muted)]"
            }`}
        >
            {len}/{max}
        </span>
    );
});

const Field = memo(function Field({ label, hint, counter, children }) {
    return (
        <label className="block min-w-0">
            <span className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="text-[12px] font-medium text-[var(--text-muted)]">
                    {label}
                </span>
                {counter}
            </span>
            {children}
            {hint && (
                <span className="mt-1 block text-[11px] leading-snug text-[var(--text-muted)]">
                    {hint}
                </span>
            )}
        </label>
    );
});

/* Premium section card — surface lift + stagger entrance (t-item-in is
   transform/opacity only, GPU-composited, respects reduced-motion). */
const Card = memo(function Card({ title, desc, delay = 0, children, className = "" }) {
    return (
        <section
            className={`t-item-in rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] p-4 sm:p-5 ${className}`}
            style={{ animationDelay: `${delay}ms`, contentVisibility: "auto", containIntrinsicSize: "auto 180px" }}
        >
            {title && (
                <header className="mb-3">
                    <h3 className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">
                        {title}
                    </h3>
                    {desc && (
                        <p className="mt-0.5 text-[12px] leading-snug text-[var(--text-muted)]">
                            {desc}
                        </p>
                    )}
                </header>
            )}
            <div className="space-y-3.5">{children}</div>
        </section>
    );
});

const PlusLock = memo(function PlusLock({ children, onUpgrade }) {
    return (
        <div className="flex items-start gap-2.5 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#a78bfa]/15">
                <Crown className="h-3.5 w-3.5 text-[#a78bfa]" strokeWidth={2} />
            </span>
            <p className="min-w-0 flex-1 text-[12px] leading-snug text-[var(--text-muted)]">
                {children}{" "}
                <button
                    type="button"
                    onClick={onUpgrade}
                    className="font-semibold text-[var(--accent)] transition-opacity hover:opacity-80"
                >
                    Upgrade
                </button>
            </p>
        </div>
    );
});

const CheckBadge = memo(function CheckBadge() {
    return (
        <span className="t-badge-pop absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)] ring-2 ring-[var(--bg-surface)]">
            <Check className="h-2.5 w-2.5" strokeWidth={3} />
        </span>
    );
});

/* ── Main modal ──────────────────────────────────────────────────────────── */

export function ProfileEditModal({ open, currentUser, onClose, onSaved }) {
    const router = useRouter();
    const [render, setRender] = useState(open);
    const [shown, setShown] = useState(false);
    const [activeTab, setActiveTab] = useState("profile");

    const [displayName, setDisplayName] = useState("");
    const [username, setUsername] = useState("");
    const [bio, setBio] = useState("");
    const [status, setStatus] = useState("");
    const [statusEmoji, setStatusEmoji] = useState("");
    const [showStatusEmojis, setShowStatusEmojis] = useState(false);
    const [pronouns, setPronouns] = useState("");
    const [statusExpiry, setStatusExpiry] = useState("");
    const [avatarStyle, setAvatarStyle] = useState("default");
    const [profileEffect, setProfileEffect] = useState("none");
    const [usernameColor, setUsernameColor] = useState(null);
    const [banner, setBanner] = useState("");
    const [country, setCountry] = useState(null);
    const [githubUsername, setGithubUsername] = useState("");
    const [xUsername, setXUsername] = useState("");
    const [instagramUsername, setInstagramUsername] = useState("");
    const [youtubeUrl, setYoutubeUrl] = useState("");
    const [websiteUrl, setWebsiteUrl] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const fileRef = useRef(null);

    const [bannerUploading, setBannerUploading] = useState(false);
    const bannerFileRef = useRef(null);

    const scrollRef = useRef(null);
    const touchStartY = useRef(null);
    const initialRef = useRef(null);

    const me = currentUser || (typeof window !== "undefined" ? getSession() : null);
    const isPlus = isPlusUser(currentUser || (typeof window !== "undefined" ? getSession() : null));

    /* Mount / unmount with one-frame delay so t-modal transition plays.
       Also snapshots initial values for dirty-tracking + locks body scroll
       (fast: single style write, restored on cleanup). */
    useEffect(() => {
        if (open) {
            const m = currentUser || getSession();
            const snap = {
                displayName: m?.displayName || "",
                username: m?.username || "",
                bio: m?.bio || "",
                status: m?.status || "",
                statusEmoji: m?.statusEmoji || "",
                pronouns: m?.pronouns || "",
                statusExpiry: isoToOption(m?.statusExpiresAt),
                avatarStyle: m?.avatarStyle || "default",
                profileEffect: m?.profileEffect || "none",
                usernameColor: m?.usernameColor || null,
                banner: m?.banner || "",
                country: m?.country || "",
                githubUsername: m?.githubUsername || "",
                xUsername: m?.xUsername || "",
                instagramUsername: m?.instagramUsername || "",
                youtubeUrl: m?.youtubeUrl || "",
                websiteUrl: m?.websiteUrl || "",
            };
            initialRef.current = snap;
            setDisplayName(snap.displayName);
            setUsername(snap.username);
            setBio(snap.bio);
            setStatus(snap.status);
            setStatusEmoji(snap.statusEmoji);
            setPronouns(snap.pronouns);
            setStatusExpiry(snap.statusExpiry);
            setAvatarStyle(snap.avatarStyle);
            setProfileEffect(snap.profileEffect);
            setUsernameColor(snap.usernameColor);
            setBanner(snap.banner);
            setCountry(
                m?.country
                    ? COUNTRIES.find((c) => c.code === m.country) || null
                    : null,
            );
            setGithubUsername(snap.githubUsername);
            setXUsername(snap.xUsername);
            setInstagramUsername(snap.instagramUsername);
            setYoutubeUrl(snap.youtubeUrl);
            setWebsiteUrl(snap.websiteUrl);
            setError(null);
            setShowStatusEmojis(false);
            setActiveTab("profile");
            setRender(true);
            const prevOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            const id = requestAnimationFrame(() => setShown(true));
            return () => {
                cancelAnimationFrame(id);
                document.body.style.overflow = prevOverflow;
            };
        }
        setShown(false);
        const t = setTimeout(() => setRender(false), 180);
        return () => clearTimeout(t);
    }, [open, currentUser]);

    // Escape to close (passive, cleaned up).
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    const close = useCallback(() => onClose(), [onClose]);

    /* Swipe-down to dismiss on mobile bottom-sheet: only when the body scroll
       is parked at the top so inner scrolling never fights the gesture. */
    const onTouchStart = useCallback((e) => {
        touchStartY.current = e.touches?.[0]?.clientY ?? null;
    }, []);
    const onTouchMove = useCallback(
        (e) => {
            if (touchStartY.current == null) return;
            const y = e.touches?.[0]?.clientY ?? 0;
            const dy = y - touchStartY.current;
            const scroller = scrollRef.current;
            if (dy > 90 && (!scroller || scroller.scrollTop <= 0)) {
                touchStartY.current = null;
                close();
            }
        },
        [close],
    );

    const goPlus = useCallback(() => {
        onClose();
        router.push("/plus");
    }, [onClose, router]);

    const openFullProfile = useCallback(() => {
        onClose();
        router.push("/u/" + (username || currentUser?.username));
    }, [onClose, router, username, currentUser?.username]);

    const handleBannerUpload = useCallback(
        async (e) => {
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
                const updated = await apiUpload("/api/v1/users/me/banner", form);
                setSession(updated, getToken());
                onSaved?.(updated);
                setBanner(updated.banner || "");
            } catch (err) {
                setError(err?.message || "Could not upload custom banner");
            } finally {
                setBannerUploading(false);
                if (bannerFileRef.current) bannerFileRef.current.value = "";
            }
        },
        [onSaved],
    );

    const handleAvatarChange = useCallback(
        async (e) => {
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
                setSession(updated, getToken());
                onSaved?.(updated);
                setPreviewUrl(null);
            } catch (err) {
                setError(err?.message || "Could not upload photo");
            } finally {
                setUploading(false);
                if (fileRef.current) fileRef.current.value = "";
            }
        },
        [onSaved],
    );

    const handleRemoveAvatar = useCallback(async () => {
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
    }, [onSaved]);

    const handleSave = useCallback(async () => {
        if (usernameColor && !isValidHex(usernameColor)) {
            setError("Name color must be a 6-digit hex like #ff5500, or pick Default.");
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const updated = await apiPatch("/api/v1/users/me", {
                displayName: displayName.trim(),
                username: username.trim(),
                bio: bio.trim(),
                pronouns: pronouns.trim(),
                status: status.trim(),
                statusEmoji: statusEmoji.trim(),
                statusExpiresAt: expiryToISO(statusExpiry),
                avatarStyle,
                profileEffect,
                usernameColor: isValidHex(usernameColor) ? usernameColor.toLowerCase() : null,
                banner,
                country: country?.code || "",
                githubUsername: githubUsername.trim(),
                xUsername: xUsername.trim(),
                instagramUsername: instagramUsername.trim(),
                youtubeUrl: youtubeUrl.trim(),
                websiteUrl: websiteUrl.trim(),
            });
            setSession(updated, getToken());
            onSaved?.(updated);
            onClose();
        } catch (err) {
            setError(err?.message || "Could not save changes");
        } finally {
            setSaving(false);
        }
    }, [
        usernameColor, displayName, username, bio, pronouns, status, statusEmoji,
        statusExpiry, avatarStyle, profileEffect, banner, country,
        githubUsername, xUsername, instagramUsername, youtubeUrl, websiteUrl,
        onSaved, onClose,
    ]);

    /* Derived (memoized — no recompute on unrelated keystrokes). */
    const completion = useMemo(() => {
        const checks = [
            !!displayName.trim(),
            !!username.trim(),
            !!bio.trim(),
            !!(me?.avatarUrl || previewUrl),
            !!banner,
            !!(status.trim() || statusEmoji),
            !!(githubUsername.trim() || xUsername.trim() || instagramUsername.trim() || websiteUrl.trim()),
            !!country,
        ];
        const done = checks.filter(Boolean).length;
        return Math.round((done / checks.length) * 100);
    }, [displayName, username, bio, me?.avatarUrl, previewUrl, banner, status, statusEmoji, githubUsername, xUsername, instagramUsername, websiteUrl, country]);

    const dirty = useMemo(() => {
        const s = initialRef.current;
        if (!s) return false;
        return (
            displayName !== s.displayName || username !== s.username || bio !== s.bio ||
            status !== s.status || statusEmoji !== s.statusEmoji || pronouns !== s.pronouns ||
            statusExpiry !== s.statusExpiry || avatarStyle !== s.avatarStyle ||
            profileEffect !== s.profileEffect ||
            (usernameColor || null)?.toString().toLowerCase() !== (s.usernameColor || null)?.toString().toLowerCase() ||
            banner !== s.banner || (country?.code || "") !== s.country ||
            githubUsername !== s.githubUsername || xUsername !== s.xUsername ||
            instagramUsername !== s.instagramUsername || youtubeUrl !== s.youtubeUrl ||
            websiteUrl !== s.websiteUrl
        );
    }, [displayName, username, bio, status, statusEmoji, pronouns, statusExpiry, avatarStyle, profileEffect, usernameColor, banner, country, githubUsername, xUsername, instagramUsername, youtubeUrl, websiteUrl]);

    const selectTab = useCallback((id) => {
        setActiveTab(id);
        setShowStatusEmojis(false);
        // Fast: reset scroll to top on tab switch (single write, no layout read).
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }, []);

    const pickVibe = useCallback((v) => {
        setStatusEmoji(v.emoji);
        setStatus(v.status);
    }, []);

    if (!render) return null;

    const avatarUrl = previewUrl || me?.avatarUrl;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4 md:p-6">
            <div
                className={`t-modal-backdrop absolute inset-0 bg-black/60 backdrop-blur-[2px] ${shown ? "is-open" : ""}`}
                onClick={close}
                aria-hidden="true"
            />
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Edit profile"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                className={`t-modal relative z-10 flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-[var(--border)] bg-[var(--bg-surface)] shadow-[0_24px_80px_-16px_rgba(0,0,0,0.6)] sm:max-h-[88dvh] sm:max-w-xl sm:rounded-3xl md:max-w-2xl ${
                    shown ? "is-open" : ""
                }`}
            >
                {/* ── Cover header: live preview ─────────────────────────── */}
                <div className="relative shrink-0">
                    <div className="relative h-[112px] w-full overflow-hidden sm:h-[132px] md:h-[148px]">
                        {banner ? (
                            <img
                                src={banner}
                                alt=""
                                aria-hidden="true"
                                draggable={false}
                                decoding="async"
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <div
                                aria-hidden="true"
                                className="h-full w-full bg-gradient-to-br from-[var(--accent)]/50 via-[#6a4cf5]/40 to-[#d44df0]/30"
                            />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-surface)] via-[var(--bg-surface)]/20 to-black/20" />
                    </div>

                    {/* Mobile drag handle */}
                    <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center pt-2 sm:hidden">
                        <span className="h-1 w-9 rounded-full bg-white/60" />
                    </div>

                    <div className="absolute right-3 top-3 flex items-center gap-2">
                        {isPlus && (
                            <span className="hidden items-center gap-1 rounded-full bg-[#a78bfa]/20 px-2.5 py-1 text-[11px] font-semibold text-[#c4b5fd] ring-1 ring-[#a78bfa]/30 backdrop-blur-sm sm:inline-flex">
                                <Crown className="h-3 w-3" strokeWidth={2.2} />
                                Plus
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={close}
                            aria-label="Close"
                            className={`flex size-9 items-center justify-center rounded-full bg-black/40 text-white/90 backdrop-blur-sm transition-[background-color,transform] duration-200 ${EASE} hover:bg-black/60 active:scale-90`}
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Avatar + identity overlapping the cover */}
                    <div className="relative flex items-end gap-3 px-4 pb-3 sm:px-6">
                        <div className="relative -mt-9 shrink-0 sm:-mt-11">
                            <span className={`block rounded-2xl ring-4 ring-[var(--bg-surface)] sm:rounded-3xl ${effectAvatarClass(profileEffect)}`}>
                                <Avatar
                                    name={displayName || me?.displayName || "?"}
                                    avatarStyle={avatarStyle}
                                    url={avatarUrl}
                                    size="lg"
                                    isPlus={isPlus}
                                />
                            </span>
                            <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                aria-label="Change profile photo"
                                className={`absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-md transition-transform duration-200 ${EASE} hover:scale-105 active:scale-95`}
                            >
                                {uploading ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Camera className="h-3.5 w-3.5" />
                                )}
                            </button>
                        </div>
                        <div className="min-w-0 flex-1 pb-0.5">
                            <p className={`truncate text-[15px] font-semibold leading-tight tracking-tight text-[var(--text-primary)] sm:text-base ${effectNameClass(profileEffect)}`}>
                                {displayName || me?.displayName || "Profile"}
                            </p>
                            <p className="truncate text-[12px] text-[var(--text-muted)]">
                                {username ? `@${username}` : "Set up your identity"}
                                {pronouns ? <span className="text-[var(--text-muted)]"> · {pronouns}</span> : null}
                            </p>
                            {(statusEmoji || status) && (
                                <p className="mt-0.5 truncate text-[12px] text-[var(--text-muted)]">
                                    {statusEmoji && <span className="mr-1">{statusEmoji}</span>}
                                    {status}
                                </p>
                            )}
                        </div>
                        {/* Completion meter */}
                        <div className="hidden shrink-0 flex-col items-end gap-1 pb-1 min-[420px]:flex">
                            <span className="text-[11px] font-medium tabular-nums text-[var(--text-muted)]">
                                {completion}% complete
                            </span>
                            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--border)]/60 sm:w-24">
                                <span
                                    className="block h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[#a78bfa] transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                                    style={{ width: `${completion}%` }}
                                />
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── Tab bar (sticky, thumb-friendly, scrolls on mobile) ── */}
                <div className="shrink-0 border-y border-[var(--border)] bg-[var(--bg-surface)]/95 px-3 py-2 backdrop-blur sm:px-5">
                    <div
                        role="tablist"
                        aria-label="Profile sections"
                        className="no-scrollbar flex gap-1 overflow-x-auto rounded-full border border-[var(--border)] bg-[var(--bg-base)] p-1 sm:grid sm:grid-cols-4 sm:overflow-visible"
                    >
                        {TABS.map((t) => {
                            const Icon = t.icon;
                            const active = activeTab === t.id;
                            return (
                                <button
                                    key={t.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={active}
                                    onClick={() => selectTab(t.id)}
                                    className={`flex h-10 min-w-[88px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-medium transition-[background-color,color,transform] duration-200 ${EASE} active:scale-[0.97] sm:min-w-0 ${
                                        active
                                            ? "bg-[var(--hover)] text-[var(--text-primary)] shadow-sm"
                                            : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                    }`}
                                >
                                    <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                                    {t.label}
                                    {t.id === "style" && !isPlus && (
                                        <Crown className="h-3 w-3 text-[#a78bfa]" strokeWidth={2.2} />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── Body (scrolls; tab panels animate with t-panel-in) ─── */}
                <div
                    ref={scrollRef}
                    className="t-scroll min-h-0 flex-1 touch-pan-y overscroll-contain overflow-y-auto px-4 py-4 sm:px-6 sm:py-5"
                    style={{ WebkitOverflowScrolling: "touch" }}
                >
                    <div key={activeTab} className="t-panel-in space-y-3.5 pb-1">
                        {activeTab === "profile" && (
                            <>
                                <Card title="Identity" desc="How you appear across Kivo." delay={0}>
                                    <div className="grid gap-3.5 sm:grid-cols-2">
                                        <Field label="Display name" counter={<Counter value={displayName} max={50} />}>
                                            <input
                                                className={inputCls}
                                                value={displayName}
                                                maxLength={50}
                                                onChange={(e) => setDisplayName(e.target.value)}
                                                placeholder="Your name"
                                                autoComplete="nickname"
                                            />
                                        </Field>
                                        <Field label="Username" hint="Letters, numbers and underscores." counter={<Counter value={username} max={30} />}>
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
                                    </div>
                                    <Field label="Pronouns" hint="Shown next to your name.">
                                        <div className="mb-2 flex flex-wrap gap-1.5">
                                            {PRONOUN_OPTIONS.map((p) => {
                                                const on = pronouns === p;
                                                return (
                                                    <button
                                                        key={p}
                                                        type="button"
                                                        onClick={() => setPronouns(on ? "" : p)}
                                                        aria-pressed={on}
                                                        className={`h-8 rounded-full border px-3 text-[12px] font-medium transition-[border-color,background-color,transform] duration-150 ${EASE} active:scale-[0.96] ${
                                                            on
                                                                ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text-primary)]"
                                                                : "border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                                        }`}
                                                    >
                                                        {p}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <input
                                            className={inputCls}
                                            value={pronouns}
                                            maxLength={20}
                                            onChange={(e) => setPronouns(e.target.value)}
                                            placeholder="he/him · she/her · they/them"
                                        />
                                    </Field>
                                    <Field label="Bio" counter={<Counter value={bio} max={280} />}>
                                        <textarea
                                            className={`${inputCls} h-auto min-h-[88px] resize-none py-2.5 leading-relaxed`}
                                            value={bio}
                                            maxLength={280}
                                            onChange={(e) => setBio(e.target.value)}
                                            placeholder="A little about you"
                                        />
                                    </Field>
                                </Card>

                                <Card title="Status" desc="An emoji chip + short line under your name." delay={60}>
                                    <div className="flex items-stretch gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowStatusEmojis((v) => !v)}
                                            aria-label="Pick a status emoji"
                                            aria-pressed={showStatusEmojis}
                                            title="Pick an emoji"
                                            className={`flex h-11 w-[52px] shrink-0 items-center justify-center rounded-xl border text-xl transition-[border-color,background-color,transform] duration-200 ${EASE} active:scale-95 ${
                                                statusEmoji
                                                    ? "border-[var(--accent)] bg-[var(--hover)]"
                                                    : "border-[var(--border)] bg-[var(--bg-surface)]"
                                            }`}
                                        >
                                            {statusEmoji || "😊"}
                                        </button>
                                        <input
                                            className={`${inputCls} flex-1`}
                                            value={status}
                                            maxLength={60}
                                            onChange={(e) => setStatus(e.target.value)}
                                            placeholder="e.g. Available"
                                        />
                                    </div>

                                    {showStatusEmojis && (
                                        <div className="t-dropdown is-open rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-2">
                                            <div className="grid grid-cols-8 gap-0.5">
                                                {STATUS_EMOJIS.map((em) => (
                                                    <button
                                                        key={em}
                                                        type="button"
                                                        onClick={() => {
                                                            setStatusEmoji(em);
                                                            setShowStatusEmojis(false);
                                                        }}
                                                        aria-label={`Status emoji ${em}`}
                                                        className={`flex aspect-square items-center justify-center rounded-lg text-lg transition-colors duration-100 ${
                                                            statusEmoji === em
                                                                ? "bg-[var(--accent)]/20 ring-1 ring-[var(--accent)]"
                                                                : "hover:bg-[var(--hover)]"
                                                        }`}
                                                    >
                                                        {em}
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
                                                    className="mt-1.5 w-full rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
                                                >
                                                    Clear emoji
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex flex-wrap gap-1.5">
                                        {VIBE_PRESETS.map((v) => {
                                            const active = status === v.status && statusEmoji === v.emoji;
                                            return (
                                                <button
                                                    key={v.label}
                                                    type="button"
                                                    onClick={() => pickVibe(v)}
                                                    aria-pressed={active}
                                                    className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition-[border-color,background-color,transform] duration-150 ${EASE} active:scale-[0.96] ${
                                                        active
                                                            ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text-primary)]"
                                                            : "border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                                    }`}
                                                >
                                                    <span className="text-[14px] leading-none">{v.emoji}</span>
                                                    {v.label}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="flex items-center gap-2.5">
                                        <span className="shrink-0 text-[12px] text-[var(--text-muted)]">Clear after</span>
                                        <select
                                            value={statusExpiry}
                                            onChange={(e) => setStatusExpiry(e.target.value)}
                                            className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 text-[13px] text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent)]"
                                        >
                                            {STATUS_EXPIRY_OPTIONS.map((o) => (
                                                <option key={o.id} value={o.id}>{o.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </Card>
                            </>
                        )}

                        {activeTab === "avatar" && (
                            <>
                                <Card title="Profile photo" desc="JPG, PNG, WebP or GIF · up to 4MB. Tap the camera badge anytime." delay={0}>
                                    <input
                                        ref={fileRef}
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp,image/gif"
                                        onChange={handleAvatarChange}
                                        className="hidden"
                                        aria-hidden
                                    />
                                    <div className="flex items-center gap-3">
                                        <span className="relative shrink-0">
                                            <Avatar
                                                name={displayName || me?.displayName || "?"}
                                                avatarStyle={avatarStyle}
                                                url={avatarUrl}
                                                size="lg"
                                                isPlus={isPlus}
                                            />
                                            {uploading && (
                                                <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/45 text-white">
                                                    <Loader2 className="h-5 w-5 animate-spin" />
                                                </span>
                                            )}
                                        </span>
                                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                                            <button
                                                type="button"
                                                onClick={() => fileRef.current?.click()}
                                                disabled={uploading}
                                                className={`flex h-11 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-4 text-[13px] font-medium text-[var(--text-primary)] transition-[border-color,background-color,transform] duration-200 ${EASE} hover:border-[var(--accent)] hover:bg-[var(--hover)] active:scale-[0.98] disabled:opacity-50`}
                                            >
                                                <Upload className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                                                {uploading ? "Uploading…" : me?.avatarUrl ? "Change photo" : "Upload photo"}
                                            </button>
                                            {me?.avatarUrl && (
                                                <button
                                                    type="button"
                                                    onClick={handleRemoveAvatar}
                                                    disabled={uploading}
                                                    className={`flex h-10 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-[var(--text-muted)] transition-[color,background-color,transform] duration-200 ${EASE} hover:bg-[var(--hover)] hover:text-[#ff5577] active:scale-[0.98] disabled:opacity-50`}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </Card>

                                <Card title="Border style" desc="A calm ring around your avatar. Gradient styles stay static by design." delay={60}>
                                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                                        {AVATAR_STYLES.map((preset) => {
                                            const active = preset.id === avatarStyle;
                                            const locked = preset.plus && !isPlus;
                                            return (
                                                <button
                                                    key={preset.id}
                                                    type="button"
                                                    onClick={() => {
                                                        if (locked) {
                                                            goPlus();
                                                            return;
                                                        }
                                                        setAvatarStyle(preset.id);
                                                    }}
                                                    aria-pressed={active}
                                                    title={locked ? `${preset.label} — Plus only` : preset.label}
                                                    className={`group relative flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl border p-2 transition-[border-color,background-color,transform] duration-200 ${EASE} active:scale-[0.95] ${
                                                        locked
                                                            ? "border-[var(--border)] opacity-70"
                                                            : active
                                                              ? "border-[var(--accent)] bg-[var(--hover)]"
                                                              : "border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--hover)]"
                                                    }`}
                                                >
                                                    <span className="relative">
                                                        <Avatar
                                                            name={displayName || me?.displayName || "?"}
                                                            avatarStyle={preset.id}
                                                            size="sm"
                                                        />
                                                        {locked && (
                                                            <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-[#a78bfa] text-white ring-2 ring-[var(--bg-base)]">
                                                                <Crown className="h-2.5 w-2.5" strokeWidth={2.2} />
                                                            </span>
                                                        )}
                                                    </span>
                                                    {active && !locked && <CheckBadge />}
                                                    <span className="flex items-center gap-1 text-[10px] font-medium leading-none text-[var(--text-muted)]">
                                                        {preset.label}
                                                        {locked && <Crown className="h-3 w-3 text-[#a78bfa]" strokeWidth={2} />}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </Card>
                            </>
                        )}

                        {activeTab === "style" && (
                            <>
                                <Card title="Banner" desc="Animated cover at the top of your profile — previewed live above." delay={0}>
                                    {isPlus ? (
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                            <input
                                                ref={bannerFileRef}
                                                type="file"
                                                accept="image/png,image/jpeg,image/webp,image/gif"
                                                onChange={handleBannerUpload}
                                                className="hidden"
                                                aria-hidden
                                            />
                                            <button
                                                type="button"
                                                onClick={() => bannerFileRef.current?.click()}
                                                disabled={bannerUploading}
                                                className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-4 text-[13px] font-medium text-[var(--text-primary)] transition-[border-color,background-color,transform] duration-200 ${EASE} hover:border-[var(--accent)] hover:bg-[var(--hover)] active:scale-[0.98] disabled:opacity-50 sm:flex-none`}
                                            >
                                                <Upload className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                                                {bannerUploading ? "Uploading…" : "Upload custom banner"}
                                            </button>
                                            <span className="text-center text-[11px] text-[var(--text-muted)] sm:text-left">
                                                GIF, JPG, PNG or WebP · up to 8MB
                                            </span>
                                        </div>
                                    ) : (
                                        <PlusLock onUpgrade={goPlus}>
                                            Custom banner uploads are a Kivo Plus perk.
                                        </PlusLock>
                                    )}
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setBanner("")}
                                            aria-pressed={!banner}
                                            className={`flex h-16 items-center justify-center rounded-xl border text-[12px] font-medium transition-[border-color,background-color,transform] duration-200 ${EASE} active:scale-[0.97] sm:h-20 ${
                                                !banner
                                                    ? "border-[var(--accent)] bg-[var(--hover)] text-[var(--text-primary)]"
                                                    : "border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:bg-[var(--hover)]"
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
                                                    className={`relative h-16 overflow-hidden rounded-xl border transition-[border-color,box-shadow,transform] duration-200 ${EASE} active:scale-[0.97] sm:h-20 ${
                                                        active
                                                            ? "border-[var(--accent)] ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-base)]"
                                                            : "border-[var(--border)] hover:brightness-110"
                                                    }`}
                                                >
                                                    <img
                                                        src={opt.url}
                                                        alt=""
                                                        aria-hidden="true"
                                                        loading="lazy"
                                                        decoding="async"
                                                        draggable={false}
                                                        className="h-full w-full object-cover"
                                                    />
                                                    {active && <CheckBadge />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </Card>

                                <Card title="Profile effects" desc="Presence flourishes everyone sees on your profile." delay={60}>
                                    {isPlus ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            {PROFILE_EFFECTS.map((fx) => {
                                                const active = profileEffect === fx.id;
                                                return (
                                                    <button
                                                        key={fx.id}
                                                        type="button"
                                                        onClick={() => setProfileEffect(fx.id)}
                                                        aria-pressed={active}
                                                        title={fx.label}
                                                        className={`group relative flex flex-col gap-2 rounded-2xl border p-3 text-left transition-[border-color,background-color,transform] duration-200 ${EASE} active:scale-[0.97] ${
                                                            active
                                                                ? "border-[var(--accent)] bg-[var(--hover)]"
                                                                : "border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--hover)]"
                                                        }`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <span className={`rounded-lg bg-[var(--bg-base)] p-0.5 ${effectAvatarClass(fx.id)}`}>
                                                                <Avatar name="A" size="xs" />
                                                            </span>
                                                            <span className={`text-[12px] font-semibold leading-none text-[var(--text-primary)] ${effectNameClass(fx.id)}`}>
                                                                Name
                                                            </span>
                                                        </span>
                                                        <span className="text-[11px] font-medium leading-tight text-[var(--text-muted)]">
                                                            {fx.label} · {fx.hint}
                                                        </span>
                                                        {active && <CheckBadge />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <PlusLock onUpgrade={goPlus}>
                                            Effects are locked on the free plan — glow avatars and animated gradient names unlock with Kivo Plus.
                                        </PlusLock>
                                    )}
                                </Card>

                                <Card title="Name color" desc="Color of your name in group chats & member lists — like Discord Nitro." delay={120}>
                                    {isPlus ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5">
                                                <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                                                    <ImageIcon className="h-3.5 w-3.5" />
                                                    Preview
                                                </span>
                                                <span
                                                    style={usernameColorStyle({ usernameColor, isPlus: true }, true)}
                                                    className={`text-[13px] font-semibold ${usernameColorClass({ usernameColor, isPlus: true }, true) || ""}`}
                                                >
                                                    {displayName || me?.displayName || "Your name"}
                                                </span>
                                                {!usernameColor && (
                                                    <span className="ml-auto text-[11px] text-[var(--text-muted)]">gradient default</span>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-6 gap-2 sm:grid-cols-7">
                                                <button
                                                    type="button"
                                                    onClick={() => setUsernameColor(null)}
                                                    aria-pressed={!usernameColor}
                                                    title="Default gradient"
                                                    className={`relative flex h-10 items-center justify-center rounded-xl border text-[11px] font-medium transition-[border-color,background-color,transform] duration-200 ${EASE} active:scale-[0.93] ${!usernameColor ? "border-[var(--accent)] bg-[var(--hover)]" : "border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--hover)]"}`}
                                                >
                                                    <span className="kivo-username-gradient text-[12px] font-bold">Aa</span>
                                                    {!usernameColor && <CheckBadge />}
                                                </button>
                                                {USERNAME_COLOR_PRESETS.map((hex) => {
                                                    const active = usernameColor?.toLowerCase() === hex.toLowerCase();
                                                    return (
                                                        <button
                                                            key={hex}
                                                            type="button"
                                                            onClick={() => setUsernameColor(hex)}
                                                            aria-pressed={active}
                                                            title={hex}
                                                            className={`relative flex h-10 items-center justify-center rounded-xl border transition-[border-color,transform] duration-200 ${EASE} active:scale-[0.93] ${active ? "border-[var(--accent)] ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-base)]" : "border-[var(--border)] hover:brightness-110"}`}
                                                            style={{ background: hex }}
                                                        >
                                                            {active && (
                                                                <span className="flex size-5 items-center justify-center rounded-full bg-white/95 text-black shadow">
                                                                    <Check className="h-3 w-3" strokeWidth={3} />
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="relative min-w-0 flex-1">
                                                    <input
                                                        value={usernameColor || ""}
                                                        onChange={(e) => {
                                                            const v = e.target.value.trim();
                                                            if (!v) {
                                                                setUsernameColor(null);
                                                                return;
                                                            }
                                                            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
                                                                if (v.length === 7) setUsernameColor(v.toLowerCase());
                                                                else if (v.length < 7) setUsernameColor(v);
                                                            }
                                                        }}
                                                        placeholder="#ff5500 or default"
                                                        maxLength={7}
                                                        spellCheck={false}
                                                        autoComplete="off"
                                                        className={`${inputCls} pr-10 font-mono`}
                                                    />
                                                    {usernameColor && (
                                                        <span
                                                            className="pointer-events-none absolute right-2.5 top-1/2 size-6 -translate-y-1/2 rounded-full border border-[var(--border)] shadow-sm"
                                                            style={{ background: usernameColor }}
                                                            aria-hidden
                                                        />
                                                    )}
                                                </div>
                                                {usernameColor && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setUsernameColor(null)}
                                                        className="h-11 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3.5 text-[12px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
                                                    >
                                                        Reset
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <PlusLock onUpgrade={goPlus}>
                                            Custom name colors are a Kivo Plus perk — your name stays muted on free.
                                        </PlusLock>
                                    )}
                                </Card>
                            </>
                        )}

                        {activeTab === "links" && (
                            <>
                                <Card title="Country" desc="A flag shown on your profile." delay={0}>
                                    <CountryPicker value={country} onChange={setCountry} />
                                </Card>

                                <Card
                                    title="Social links"
                                    desc="Handles and sites shown as icon chips. GitHub also powers your contribution graph."
                                    delay={60}
                                >
                                    <div className="grid gap-3.5 sm:grid-cols-2">
                                        <Field label="GitHub">
                                            <div className="flex items-stretch gap-2">
                                                <span className="flex h-11 shrink-0 items-center rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 text-[13px] text-[var(--text-muted)]">
                                                    @
                                                </span>
                                                <input
                                                    className={`${inputCls} flex-1 px-3`}
                                                    value={githubUsername}
                                                    maxLength={39}
                                                    onChange={(e) => setGithubUsername(e.target.value)}
                                                    placeholder="username"
                                                    spellCheck={false}
                                                    autoComplete="off"
                                                />
                                            </div>
                                        </Field>
                                        <Field label="X (Twitter)">
                                            <div className="flex items-stretch gap-2">
                                                <span className="flex h-11 shrink-0 items-center rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 text-[13px] text-[var(--text-muted)]">
                                                    @
                                                </span>
                                                <input
                                                    className={`${inputCls} flex-1 px-3`}
                                                    value={xUsername}
                                                    maxLength={60}
                                                    onChange={(e) => setXUsername(e.target.value)}
                                                    placeholder="username"
                                                    spellCheck={false}
                                                    autoComplete="off"
                                                />
                                            </div>
                                        </Field>
                                        <Field label="Instagram">
                                            <div className="flex items-stretch gap-2">
                                                <span className="flex h-11 shrink-0 items-center rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 text-[13px] text-[var(--text-muted)]">
                                                    @
                                                </span>
                                                <input
                                                    className={`${inputCls} flex-1 px-3`}
                                                    value={instagramUsername}
                                                    maxLength={60}
                                                    onChange={(e) => setInstagramUsername(e.target.value)}
                                                    placeholder="username"
                                                    spellCheck={false}
                                                    autoComplete="off"
                                                />
                                            </div>
                                        </Field>
                                        <Field label="YouTube" hint="Full channel link.">
                                            <input
                                                className={inputCls}
                                                value={youtubeUrl}
                                                maxLength={500}
                                                onChange={(e) => setYoutubeUrl(e.target.value)}
                                                placeholder="https://youtube.com/@channel"
                                                spellCheck={false}
                                                autoComplete="off"
                                                inputMode="url"
                                            />
                                        </Field>
                                        <div className="sm:col-span-2">
                                            <Field label="Website" hint="Full link (https://…).">
                                                <input
                                                    className={inputCls}
                                                    value={websiteUrl}
                                                    maxLength={500}
                                                    onChange={(e) => setWebsiteUrl(e.target.value)}
                                                    placeholder="https://example.com"
                                                    spellCheck={false}
                                                    autoComplete="off"
                                                    inputMode="url"
                                                />
                                            </Field>
                                        </div>
                                    </div>
                                </Card>
                            </>
                        )}

                        {error && (
                            <div
                                role="alert"
                                className="t-badge-pop flex items-start gap-2 rounded-2xl border border-[#ff5577]/25 bg-[#ff5577]/10 px-3.5 py-3 text-[12px] leading-snug text-[#ff9ab3]"
                            >
                                <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span className="min-w-0 flex-1">{error}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Footer (sticky, safe-area aware) ─────────────────────── */}
                <div className="flex shrink-0 items-center gap-2 border-t border-[var(--border)] bg-[var(--bg-surface)]/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:gap-3 sm:px-6">
                    <button
                        type="button"
                        onClick={openFullProfile}
                        aria-label="View public profile"
                        title="View public profile"
                        className="flex size-11 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors duration-200 hover:bg-[var(--hover)] hover:text-[var(--text-primary)] min-[420px]:hidden"
                    >
                        <UserIcon className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={openFullProfile}
                        className="hidden h-11 items-center rounded-full px-3 text-[13px] font-medium text-[var(--text-muted)] transition-colors duration-200 hover:bg-[var(--hover)] hover:text-[var(--text-primary)] min-[420px]:flex"
                    >
                        View public profile
                    </button>
                    <div className="flex flex-1 items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={close}
                            disabled={saving}
                            className={`flex h-11 items-center justify-center rounded-full border border-[var(--border)] px-5 text-[13px] font-medium text-[var(--text-primary)] transition-[background-color,transform] duration-200 ${EASE} hover:bg-[var(--hover)] active:scale-[0.98] disabled:opacity-50`}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || !dirty}
                            className={`relative flex h-11 min-w-[132px] items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 text-[13px] font-semibold text-[var(--on-accent)] shadow-[0_6px_20px_-8px_var(--accent)] transition-[filter,transform,opacity] duration-200 ${EASE} hover:brightness-110 active:scale-[0.98] disabled:opacity-50 sm:min-w-[148px]`}
                        >
                            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            {saving ? "Saving…" : "Save changes"}
                            {dirty && !saving && (
                                <span className="t-badge-pop absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-[#22c55e] ring-2 ring-[var(--bg-surface)]" aria-hidden />
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ProfileEditModal;
