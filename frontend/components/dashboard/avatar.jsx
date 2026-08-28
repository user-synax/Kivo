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

const SIZE = {
  lg: "size-20 text-3xl",
  md: "size-10 text-sm",
  sm: "size-9 text-[13px]",
};

// Single avatar surface, reused by the sidebar (profile + conversation list)
// and the chat header. `avatarStyle` is an id from lib/avatar-styles; it
// renders either a solid colored ring or a static gradient ring so the choice
// is visible to friends. Border color transitions smoothly on change.
function AvatarSurface({ name, selected, online, avatarStyle, size = "md" }) {
  const style = getAvatarStyle(avatarStyle);
  const isGradient = style.kind === "gradient";

  return (
    <div
      className={clsx(
        "relative flex items-center justify-center rounded-lg font-medium",
        SIZE[size] || SIZE.md,
        selected
          ? "bg-[var(--accent)] text-[var(--on-accent)]"
          : "bg-[var(--bg-surface)] text-[var(--text-primary)]",
        !isGradient &&
          (style.color
            ? "transition-[border-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
            : "border border-[var(--border)]"),
      )}
      style={
        !isGradient && style.color
          ? { border: `2px solid ${style.color}` }
          : undefined
      }
    >
      {initials(name)}
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-[var(--online)] ring-2 ring-[var(--bg-elevated)]" />
      )}
    </div>
  );
}

export function Avatar({ name, selected, online, avatarStyle, size = "md" }) {
  const style = getAvatarStyle(avatarStyle);
  // Gradient ring: a thin gradient wrapper with the surface avatar inset, so the
  // rounded corners stay crisp. No glow, no animation.
  if (style.kind === "gradient") {
    return (
      <div
        className="inline-block rounded-lg p-[2px]"
        style={{ background: style.gradient }}
      >
        <AvatarSurface
          name={name}
          selected={selected}
          online={online}
          size={size}
          avatarStyle={null}
        />
      </div>
    );
  }
  return (
    <AvatarSurface
      name={name}
      selected={selected}
      online={online}
      size={size}
      avatarStyle={avatarStyle}
    />
  );
}

export default Avatar;
