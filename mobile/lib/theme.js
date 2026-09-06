// Theme tokens for native — ported from frontend/lib/theme.js (single source
// of truth stays web; this mirrors the Framer default + accent so chat and
// auth screens share the brand without CSS variables, which RN lacks).
export const colors = {
  base: "#090909",
  surface: "#141414",
  elevated: "#1c1c1c",
  textPrimary: "#ffffff",
  textMuted: "#999999",
  border: "#262626",
  accent: "#4ba9e1",
  online: "#22c55e",
  danger: "#f87171",
};

export const themeOrder = [
  "framer",
  "midnight",
  "graphite",
  "espresso",
  "pine",
  "plum",
  "porcelain",
  "linen",
  "mist",
  "sage",
];

export const defaultThemeId = "framer";
