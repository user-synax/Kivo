// Single source of truth for the dashboard themes.
//
// Every visual surface in /app reads its colors from CSS custom properties
// that these objects feed (see components/theme-provider.jsx). Switching a theme
// re-skins the entire product - no component edits required. Components must
// only ever reference design tokens through var(--...) / Tailwind utilities, never
// hardcoded hex.
//
// Themes are COLOR-ONLY. Geometry (corner radius), elevation (shadows) and every
// other part of the layout language live in globals.css as global design tokens,
// so the whole product keeps one consistent shape across every palette and the
// UI looks intentional in light and dark alike.

// Light palettes -------------------------------------------------------------
const JITTER_LIGHT = {
  base: "#f2f1f3",
  surface: "#ffffff",
  elevated: "#ffffff",
  textPrimary: "#19171c",
  textMuted: "#6e6e73",
  border: "#e5e4e7",
  accent: "#7a40ed",
  hover: "rgba(25, 23, 28, 0.05)",
  bubbleSent: "#7a40ed",
  bubbleReceived: "#ffffff",
  unreadBadge: "#7a40ed",
  onAccent: "#ffffff",
  online: "#16a06a",
  accentSoft: "rgba(122, 64, 237, 0.10)",
  glassHighlight: "rgba(255, 255, 255, 0.9)",
  scrollbarThumb: "#dcdce0",
  scrollbarThumbHover: "#97979b",
};

const CLOUD_LIGHT = {
  base: "#eef1f6",
  surface: "#ffffff",
  elevated: "#ffffff",
  textPrimary: "#16181d",
  textMuted: "#6b7280",
  border: "#dbe0ea",
  accent: "#6d4aee",
  hover: "rgba(22, 24, 29, 0.05)",
  bubbleSent: "#6d4aee",
  bubbleReceived: "#ffffff",
  unreadBadge: "#6d4aee",
  onAccent: "#ffffff",
  online: "#0f9d6b",
  accentSoft: "rgba(109, 74, 238, 0.10)",
  glassHighlight: "rgba(255, 255, 255, 0.92)",
  scrollbarThumb: "#d2d8e4",
  scrollbarThumbHover: "#9aa3b2",
};

const SAND_LIGHT = {
  base: "#f6f2ec",
  surface: "#fffdfa",
  elevated: "#fffdfa",
  textPrimary: "#211c16",
  textMuted: "#7a7065",
  border: "#e7e0d5",
  accent: "#8b5cf6",
  hover: "rgba(33, 28, 22, 0.05)",
  bubbleSent: "#8b5cf6",
  bubbleReceived: "#fffdfa",
  unreadBadge: "#8b5cf6",
  onAccent: "#ffffff",
  online: "#11916b",
  accentSoft: "rgba(139, 92, 246, 0.10)",
  glassHighlight: "rgba(255, 255, 255, 0.95)",
  scrollbarThumb: "#e0d8cc",
  scrollbarThumbHover: "#a89c8b",
};

// Dark palettes --------------------------------------------------------------
const INK_DARK = {
  base: "#19171c",
  surface: "#231f29",
  elevated: "#2a2531",
  textPrimary: "#f4f2f6",
  textMuted: "#97979b",
  border: "#3a3442",
  accent: "#7a40ed",
  hover: "rgba(255, 255, 255, 0.06)",
  bubbleSent: "#7a40ed",
  bubbleReceived: "#2a2730",
  unreadBadge: "#7a40ed",
  onAccent: "#ffffff",
  online: "#2fd29a",
  accentSoft: "rgba(122, 64, 237, 0.20)",
  glassHighlight: "rgba(255, 255, 255, 0.08)",
  scrollbarThumb: "#3a3442",
  scrollbarThumbHover: "#6e6e73",
};

const MIDNIGHT_DARK = {
  base: "#0e1116",
  surface: "#161b22",
  elevated: "#1c222b",
  textPrimary: "#e7ecf3",
  textMuted: "#8b95a3",
  border: "#2a313c",
  accent: "#7c5cff",
  hover: "rgba(255, 255, 255, 0.05)",
  bubbleSent: "#7c5cff",
  bubbleReceived: "#1c222b",
  unreadBadge: "#7c5cff",
  onAccent: "#ffffff",
  online: "#34d399",
  accentSoft: "rgba(124, 92, 255, 0.20)",
  glassHighlight: "rgba(255, 255, 255, 0.07)",
  scrollbarThumb: "#2a313c",
  scrollbarThumbHover: "#5a6473",
};

export const themes = {
  // Jitter - the default light palette: off-white canvas, ink text, violet accent.
  jitter: {
    id: "jitter",
    label: "Jitter",
    swatch: "#7a40ed",
    colors: JITTER_LIGHT,
  },

  // Cloud - cool, airy blue-grey canvas with an indigo accent.
  cloud: {
    id: "cloud",
    label: "Cloud",
    swatch: "#6d4aee",
    colors: CLOUD_LIGHT,
  },

  // Sand - warm ivory canvas with a soft violet accent.
  sand: {
    id: "sand",
    label: "Sand",
    swatch: "#8b5cf6",
    colors: SAND_LIGHT,
  },

  // Ink - the default dark palette: near-black canvas, luminous text, violet accent.
  ink: {
    id: "ink",
    label: "Ink",
    swatch: "#a981ff",
    colors: INK_DARK,
  },

  // Midnight - deep navy canvas with an electric-violet accent.
  midnight: {
    id: "midnight",
    label: "Midnight",
    swatch: "#7c5cff",
    colors: MIDNIGHT_DARK,
  },
};

export const themeOrder = ["jitter", "cloud", "sand", "ink", "midnight"];
export const defaultThemeId = "jitter";
export const THEME_STORAGE_KEY = "kivo:theme";

// Flat map of CSS custom property name -> value for a given theme id.
// Only color tokens are injected here; radius + shadow are global design tokens
// in globals.css, so the geometry of the UI never changes between themes.
export function cssVarsFor(themeId) {
  const theme = themes[themeId] || themes[defaultThemeId];
  const c = theme.colors;
  return {
    // Color surface tokens
    "--bg-base": c.base,
    "--bg-surface": c.surface,
    "--bg-elevated": c.elevated,
    "--text-primary": c.textPrimary,
    "--text-muted": c.textMuted,
    "--border": c.border,
    "--accent": c.accent,
    "--hover": c.hover,
    "--bubble-sent": c.bubbleSent,
    "--bubble-received": c.bubbleReceived,
    "--unread-badge": c.unreadBadge,
    "--on-accent": c.onAccent,
    "--online": c.online,
    "--accent-soft": c.accentSoft,
    "--glass-highlight": c.glassHighlight,
    "--scrollbar-thumb": c.scrollbarThumb,
    "--scrollbar-thumb-hover": c.scrollbarThumbHover,
  };
}
