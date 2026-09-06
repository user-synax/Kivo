// Interface styles ("UI skins") for /app.
//
// The color theme (lib/theme.js: preset + accent/tint) and the chat look
// (lib/chat-style.js: wallpaper/bubbleStyle) control *colors*. The interface
// style controls *geometry + elevation*: corner radius, border weight and
// shadow language. It is orthogonal — every skin reads the active palette via
// var(--...) so base themes + studio colors keep working.
//
// Only /app is skinned: ThemeProvider (components/theme-provider.jsx) sets
// `data-ui` on its wrapper + mirrors it to <body> (so <body> portals like the
// receipts card match), and app/app/ui-skins.css scopes every rule to
// `[data-ui="..."]`. Landing/marketing never renders that attribute, so it is
// untouched.

export const UI_STYLES = [
  {
    id: "default",
    label: "Default",
    hint: "Clean Framer look — hairlines, pills, soft depth",
  },
  {
    id: "neo-brutalism",
    label: "Neo-Brutalism",
    hint: "Soft thick borders, subtle hard shadows, squared corners",
  },
  {
    id: "claymorphism",
    label: "Claymorphism",
    hint: "Soft puffy 3D — inflated cards, pillowy shadows",
  },
  {
    id: "flat-minimal",
    label: "Flat Minimal",
    hint: "Crisp hairlines, small corners, zero elevation",
  },
];

export const UI_STYLE_ORDER = [
  "default",
  "neo-brutalism",
  "claymorphism",
  "flat-minimal",
];

export const defaultUiStyleId = "default";

export const UI_STYLE_STORAGE_KEY = "kivo:ui-style";

export function isValidUiStyle(id) {
  return UI_STYLE_ORDER.includes(id);
}

// Extra CSS vars layered on top of cssVarsForColors(). Inline (not stylesheet)
// so they beat the palette's own --border/--shadow/--radius-* which arrive via
// the same inline style object.
//
// Soft-brutal: ink is washed with transparency (color-mix) and offsets are
// small (2-4px), so dark presets don't glare pure-white frames. Uses the
// derived palette's own ink hex, so the skin stays readable on dark AND light
// presets and respects custom accent/tint (ink is never tinted).
export function skinVarsFor(uiStyleId, colors) {
  if (!colors) return {};
  if (uiStyleId === "claymorphism") return clayVarsFor(colors);
  if (uiStyleId === "flat-minimal") return flatVarsFor(colors);
  if (uiStyleId !== "neo-brutalism") return {};
  const ink = colors.textPrimary;
  // Softened line + shadow tones derived from the active ink.
  const line = `color-mix(in srgb, ${ink} 52%, transparent)`;
  const shadowTone = (pct) => `color-mix(in srgb, ${ink} ${pct}%, transparent)`;
  return {
    // Squared geometry — pills become chunky 8px rects.
    "--radius-sm": "4px",
    "--radius-md": "6px",
    "--radius-lg": "8px",
    "--radius-xl": "8px",
    "--radius-2xl": "10px",
    "--radius-3xl": "12px",
    "--radius-pills": "8px",
    "--radius-nav": "8px",
    "--radius-cards": "10px",
    "--radius-inputs": "8px",
    "--radius-buttons": "8px",
    // Softened hairline replacement: every border-[var(--border)] turns into
    // a muted ink border instead of a glaring pure-ink one.
    "--border": line,
    // Small hard offset shadows — no blur, no light-edge inset.
    "--shadow-sm": `2px 2px 0 ${shadowTone(30)}`,
    "--shadow-md": `3px 3px 0 ${shadowTone(30)}`,
    "--shadow-lg": `4px 4px 0 ${shadowTone(30)}`,
    "--shadow-xl": `5px 5px 0 ${shadowTone(30)}`,
    // Dedicated tokens so ui-skins.css + <body> portals share one source.
    // Fallbacks in CSS (`var(--brutal-border, var(--border))`) keep landing
    // safe even if the body mirror is missing.
    "--brutal-border": line,
    "--brutal-shadow-sm": `2px 2px 0 ${shadowTone(30)}`,
    "--brutal-shadow-md": `3px 3px 0 ${shadowTone(30)}`,
    "--brutal-shadow-lg": `4px 4px 0 ${shadowTone(32)}`,
  };
}

// Vars mirrored onto <body> while /app is mounted so <body>-portaled
// surfaces (receipts card, context menus, modals) resolve the same soft
// tokens. Wrapper already has them inline; portals don't inherit from it.
export const BRUTAL_BODY_VARS = [
  "--brutal-border",
  "--brutal-shadow-sm",
  "--brutal-shadow-md",
  "--brutal-shadow-lg",
  "--border",
  "--shadow-md",
  "--shadow-lg",
];

// Claymorphism: soft puffy inflated-clay 3D. Big radii, barely-there borders,
// pillowy multi-layer shadows (inner light + inner shade + blurred outer).
// Outer glow uses the active ink at low opacity so it lifts on dark presets
// (whitish haze) and drops on light presets (grey haze) — one definition,
// both families. Respects custom accent/tint (ink is never tinted).
function clayVarsFor(colors) {
  const ink = colors.textPrimary;
  const line = `color-mix(in srgb, ${ink} 14%, transparent)`;
  const puff = (pct) => `color-mix(in srgb, ${ink} ${pct}%, transparent)`;
  const sm = `inset 1px 1px 2px rgba(255, 255, 255, 0.16), inset -1px -1px 2px rgba(0, 0, 0, 0.16), 2px 4px 10px ${puff(18)}`;
  const md = `inset 2px 2px 4px rgba(255, 255, 255, 0.14), inset -2px -2px 4px rgba(0, 0, 0, 0.18), 0 10px 24px ${puff(20)}`;
  const lg = `inset 2px 2px 5px rgba(255, 255, 255, 0.14), inset -3px -3px 6px rgba(0, 0, 0, 0.2), 0 16px 36px ${puff(22)}`;
  const xl = `inset 2px 2px 6px rgba(255, 255, 255, 0.14), inset -3px -3px 8px rgba(0, 0, 0, 0.22), 0 22px 48px ${puff(24)}`;
  return {
    // Puffy geometry — everything inflates, pills stay fully round.
    "--radius-sm": "12px",
    "--radius-md": "16px",
    "--radius-lg": "18px",
    "--radius-xl": "20px",
    "--radius-2xl": "24px",
    "--radius-3xl": "28px",
    "--radius-pills": "9999px",
    "--radius-nav": "18px",
    "--radius-cards": "24px",
    "--radius-inputs": "16px",
    "--radius-buttons": "18px",
    // Barely-there border — clay holds shape with shadow, not lines.
    "--border": line,
    "--shadow-sm": sm,
    "--shadow-md": md,
    "--shadow-lg": lg,
    "--shadow-xl": xl,
    // Dedicated tokens so ui-skins.css + <body> portals share one source.
    "--clay-border": line,
    "--clay-shadow-sm": sm,
    "--clay-shadow-md": md,
    "--clay-shadow-lg": lg,
    // Pressed state: outer glow removed, inner shade deepens (pushed-in clay).
    "--clay-pressed":
      "inset 2px 3px 6px rgba(0, 0, 0, 0.22), inset -1px -1px 3px rgba(255, 255, 255, 0.1)",
  };
}

export const CLAY_BODY_VARS = [
  "--clay-border",
  "--clay-shadow-sm",
  "--clay-shadow-md",
  "--clay-shadow-lg",
  "--border",
  "--shadow-md",
  "--shadow-lg",
];

// Flat Minimal: crisp Linear-style flatness. Small radii, palette hairlines,
// zero elevation. --border is re-declared with the palette's own value so the
// <body> mirror carries the themed hairline to portals (which otherwise fall
// back to the :root neutral — wrong on light presets).
function flatVarsFor(colors) {
  return {
    "--radius-sm": "4px",
    "--radius-md": "6px",
    "--radius-lg": "6px",
    "--radius-xl": "8px",
    "--radius-2xl": "10px",
    "--radius-3xl": "12px",
    "--radius-pills": "8px",
    "--radius-nav": "8px",
    "--radius-cards": "8px",
    "--radius-inputs": "6px",
    "--radius-buttons": "8px",
    "--border": colors.border,
    "--shadow-sm": "none",
    "--shadow-md": "none",
    "--shadow-lg": "none",
    "--shadow-xl": "none",
  };
}

export const FLAT_BODY_VARS = ["--border"];

// Union mirrored by ThemeProvider — covers whichever skin is active.
export const SKIN_BODY_VARS = [
  ...new Set([...BRUTAL_BODY_VARS, ...CLAY_BODY_VARS, ...FLAT_BODY_VARS]),
];
