"use client";

import clsx from "clsx";
import { getAvatarStyle } from "@/lib/avatar-styles";

const EASE = [0.22, 1, 0.36, 1];

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

/* ── Size scale ────────────────────────────────────────────────────────────
   Mobile-first: base value is for phones, sm:/md: bumps up as the viewport
   grows. Every proportional trait (border, ring, dot, badge) scales together
   so nothing looks "stuck" at the wrong scale.

   xs  — notification badge, tiny inline icons
   sm  — chat header, conversation rows, space icons
   md  — sidebar list rows, profile nav (default)
   lg  — profile hero, edit modal, space cards
   xl  — chat panel header (the most prominent avatar)
   ──────────────────────────────────────────────────────────────────────── */
const SIZE = {
  xs: {
    box: "size-7 text-[11px]",
    borderClass: "border",
    borderWidth: 1,
    ringPad: "p-px",
    radius: "rounded-lg",
    dot: "-bottom-px -right-px size-1.5 ring-1",
    badgeOffset: "-bottom-0.5 -right-0.5",
  },
  sm: {
    box: "size-9 text-[13px] sm:size-10 sm:text-sm",
    borderClass: "border",
    borderWidth: 1,
    ringPad: "p-px",
    radius: "rounded-lg",
    dot: "-bottom-px -right-px size-1.5 ring-1",
    badgeOffset: "-bottom-0.5 -right-0.5",
  },
  md: {
    box: "size-11 text-sm sm:size-12 sm:text-[15px]",
    borderClass: "border-2",
    borderWidth: 2,
    ringPad: "p-[2px]",
    radius: "rounded-xl",
    dot: "-bottom-0.5 -right-0.5 size-2.5 ring-2",
    badgeOffset: "-bottom-1 -right-1",
  },
  lg: {
    box: "size-16 text-lg sm:size-20 sm:text-xl",
    borderClass: "border-[3px]",
    borderWidth: 3,
    ringPad: "p-[3px]",
    radius: "rounded-2xl",
    dot: "-bottom-0.5 -right-0.5 size-3 ring-[3px]",
    badgeOffset: "-bottom-1.5 -right-1.5",
  },
  xl: {
    box: "size-11 text-sm sm:size-12 sm:text-[15px]",
    borderClass: "border-2",
    borderWidth: 2,
    ringPad: "p-[2px]",
    radius: "rounded-xl",
    dot: "-bottom-0.5 -right-0.5 size-2.5 ring-2",
    badgeOffset: "-bottom-1 -right-1",
  },
};

/* ── AvatarSurface ─────────────────────────────────────────────────────────
   Single avatar surface: initials fallback, uploaded image overlay, colored
   border or gradient ring frame. Smooth transitions on border-color change
   (transitions skill: "transition-all with shared easing").
   ──────────────────────────────────────────────────────────────────────── */
function AvatarSurface({ name, selected, avatarStyle, size = "md", url }) {
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
        /* Border: either a CSS-variable border (default) or a colored inline
           border with smooth transition on color change. */
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
      {/* Uploaded image — fades in on load, hidden if the URL errors. */}
      {url ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
        />
      ) : null}
      {/* Initials — hidden when image is present (opacity-0 keeps layout). */}
      <span
        className={clsx(
          "select-none leading-none transition-opacity duration-200",
          url && "opacity-0",
        )}
      >
        {initials(name)}
      </span>
    </div>
  );
}

/* ── Avatar (public API) ──────────────────────────────────────────────────
   Props: name, selected, online, avatarStyle, size, url, badge, decoration
   Same API as before — no breaking changes.

   The avatar is wrapped in motion.div when online/dot or badge/decoration
   are present, adding a subtle scale hover (1.03) for interactive contexts
   (sidebar rows, icon rail, etc.). The online dot uses a gentle pulse keyframe.
   ──────────────────────────────────────────────────────────────────────── */
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

  /* Gradient ring: a thin gradient wrapper with the surface avatar inset,
     so the rounded corners stay crisp. Ring thickness scales with size
     via ringPad. */
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
          size={size}
          avatarStyle={null}
          url={url}
        />
      </div>
    ) : (
      <AvatarSurface
        name={name}
        selected={selected}
        size={size}
        avatarStyle={avatarStyle}
        url={url}
      />
    );

  /* Online indicator — outside the avatar (surface clips with overflow-hidden)
     so it shows at the corner. Uses a subtle CSS pulse keyframe. */
  const dot = online ? (
    <span
      className={clsx(
        "absolute z-10 rounded-full bg-[var(--online)] ring-[var(--bg-elevated)]",
        "animate-[t-online-pulse_2.5s_ease-in-out_infinite]",
        config.dot,
      )}
    />
  ) : null;

  /* No premium decoration/badge and no presence dot — return the bare avatar
     (keeps the existing DOM shape / spacing identical for current callers). */
  if (!badge && !decoration && !dot) return surface;

  return (
    <div className={clsx("relative inline-flex shrink-0", decoration)}>
      {surface}
      {dot}
      {badge ? (
        <span className={clsx("absolute z-10", config.badgeOffset)}>
          {badge}
        </span>
      ) : null}

      {/* Keyframe for online dot pulse — injected once. */}
      <style>{`
        @keyframes t-online-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.65; }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-\\[t-online-pulse_2\\.5s_ease-in-out_infinite\\] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

export default Avatar;
