"use client";

import clsx from "clsx";
import { getAvatarStyle } from "@/lib/avatar-styles";

function initials(name) {
    const clean = (name || "?").trim();
    if (!clean || clean === "?") return "?";
    return clean
        .split(/\s+/)
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

// Every trait that should grow with the avatar lives here, keyed by size, so
// nothing (border weight, gradient ring, presence dot, badge offset) looks
// "stuck" at one scale while the box around it grows. Mobile-first: the base
// (unprefixed) value is what phones get; sm:/md: bump things up as the
// viewport — and usually the layout — grows.
const SIZE = {
    // Compact: chat header, conversation rows on tight layouts.
    sm: {
        box: "size-9 text-[13px] sm:size-10 sm:text-sm",
        borderClass: "border",
        borderWidth: 1,
        ringPad: "p-px",
        radius: "rounded-lg",
        dot: "-bottom-px -right-px size-1.5 ring-1",
        badgeOffset: "-bottom-0.5 -right-0.5",
    },
    // Default: sidebar list rows, profile nav.
    md: {
        box: "size-9 text-[13px] sm:size-10 sm:text-sm",

        borderClass: "border-2",
        borderWidth: 2,
        ringPad: "p-[2px]",
        radius: "rounded-lg",
        dot: "-bottom-0.5 -right-0.5 size-2 ring-2",
        badgeOffset: "-bottom-1 -right-1",
    },
    // Hero: detail panel / profile editor. Scales up modestly with the viewport
    // and is capped early (md:) so it reads as a confident hero without
    // dominating the layout — leaving room for premium frames later.
    lg: {
        box: "size-9 text-[13px] sm:size-10 sm:text-sm",

        borderClass: "border-[3px]",
        borderWidth: 3,
        ringPad: "p-[3px]",
        radius: "rounded-xl",
        dot: "-bottom-1 -right-1 size-3.5 ring-[3px]",
        badgeOffset: "-bottom-1.5 -right-1.5",
    },
};

// Single avatar surface, reused by the sidebar (profile + conversation list),
// the chat header, and the detail panel. `avatarStyle` renders either a solid
// colored ring or a static gradient ring so the choice is visible to friends.
// `url` (an uploaded display picture) is painted over the initials; the ring
// decoration from avatarStyle still frames the photo. `badge`/`decoration`
// are reserved hooks for premium avatar frames/themes added later.
function AvatarSurface({
    name,
    selected,
    online,
    avatarStyle,
    size = "md",
    url,
}) {
    const config = SIZE[size] || SIZE.md;
    const style = getAvatarStyle(avatarStyle);
    const isGradient = style.kind === "gradient";

    return (
        <div
            className={clsx(
                "relative flex shrink-0 items-center justify-center overflow-hidden font-medium",
                config.box,
                config.radius,
                selected
                    ? "bg-[var(--accent)] text-[var(--on-accent)]"
                    : "bg-[var(--bg-surface)] text-[var(--text-primary)]",
                !isGradient &&
                    (style.color
                        ? "transition-[border-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
                        : clsx(config.borderClass, "border-[var(--border)]")),
            )}
            style={
                !isGradient && style.color
                    ? { border: `${config.borderWidth}px solid ${style.color}` }
                    : undefined
            }
        >
            {url ? (
                // biome-ignore lint/performance/noImgElement: avatars are dynamic remote URLs from Appwrite Storage (no fixed hostname for next/image).
                <img
                    src={url}
                    alt=""
                    loading="lazy"
                    onError={(e) => {
                        e.currentTarget.style.display = "none";
                    }}
                    className="absolute inset-0 h-full w-full object-cover"
                />
            ) : null}
            <span
                className={clsx("select-none leading-none", url && "opacity-0")}
            >
                {initials(name)}
            </span>
            {online && (
                <span
                    className={clsx(
                        "absolute rounded-full bg-[var(--online)] ring-[var(--bg-elevated)]",
                        config.dot,
                    )}
                />
            )}
        </div>
    );
}

export function Avatar({
    name,
    selected,
    online,
    avatarStyle,
    size = "md",
    url,
    badge,
    decoration,
}) {
    const config = SIZE[size] || SIZE.md;
    const style = getAvatarStyle(avatarStyle);

    // Gradient ring: a thin gradient wrapper with the surface avatar inset, so the
    // rounded corners stay crisp. Ring thickness scales with size via ringPad.
    const surface =
        style.kind === "gradient" ? (
            <div
                className={clsx(
                    "inline-block shrink-0",
                    config.radius,
                    config.ringPad,
                )}
                style={{ background: style.gradient }}
            >
                <AvatarSurface
                    name={name}
                    selected={selected}
                    online={online}
                    size={size}
                    avatarStyle={null}
                    url={url}
                />
            </div>
        ) : (
            <AvatarSurface
                name={name}
                selected={selected}
                online={online}
                size={size}
                avatarStyle={avatarStyle}
                url={url}
            />
        );

    // No premium decoration/badge requested — return the bare avatar (keeps the
    // existing DOM shape / spacing identical for current callers).
    if (!badge && !decoration) return surface;

    return (
        <div className={clsx("relative inline-flex shrink-0", decoration)}>
            {surface}
            {badge ? (
                <span className={clsx("absolute", config.badgeOffset)}>
                    {badge}
                </span>
            ) : null}
        </div>
    );
}

export default Avatar;
