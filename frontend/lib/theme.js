// Single source of truth for the dashboard themes.
//
// Every visual surface in /app reads its colors from CSS custom properties
// that these objects feed (see components/theme-provider.jsx). Switching a theme
// re-skins the entire product — no component edits required. Components must
// only ever reference colors through var(--…), never hardcoded hex.

export const themes = {
  // Replit — the new default design system (warm workshop with coral sparks).
  // Light, warm canvas (#faf6f1) with a single vivid ember-orange accent.
  replit: {
    id: "replit",
    label: "Replit",
    swatch: "#ff3c00",
    colors: {
      base: "#faf6f1",
      surface: "#ffffff",
      elevated: "#ffffff",
      textPrimary: "#0e0e0f",
      textMuted: "#52545a",
      border: "#dfddd8",
      accent: "#ff3c00",
      hover: "rgba(14, 14, 15, 0.06)",
      bubbleSent: "#ff764c",
      bubbleReceived: "#ffffff",
      unreadBadge: "#ff3c00",
      onAccent: "#ffffff",
      online: "#2492ff",
    },
  },

  // Replit Ink — the Replit design system in its dark-preview variant.
  replitInk: {
    id: "replitInk",
    label: "Replit Ink",
    swatch: "#ff764c",
    colors: {
      base: "#1a1919",
      surface: "#0e0e0f",
      elevated: "#0e0e0f",
      textPrimary: "#faf6f1",
      textMuted: "#898c94",
      border: "#312e2e",
      accent: "#ff3c00",
      hover: "rgba(255, 255, 255, 0.07)",
      bubbleSent: "#ff764c",
      bubbleReceived: "#212121",
      unreadBadge: "#ff3c00",
      onAccent: "#ffffff",
      online: "#2492ff",
    },
  },

  // Phosphor — the original terminal palette (Void Black + rationed lime).
  phosphor: {
    id: "phosphor",
    label: "Phosphor",
    swatch: "#7fee64",
    colors: {
      base: "#000000",
      surface: "#181818",
      elevated: "#212525",
      textPrimary: "#ddffdc",
      textMuted: "#8cab87",
      border: "#485346",
      accent: "#7fee64",
      hover: "rgba(72, 83, 70, 0.18)",
      bubbleSent: "#1d2b1d",
      bubbleReceived: "#181818",
      unreadBadge: "#7fee64",
      onAccent: "#181818",
      online: "#7fee64",
    },
  },

  // Aurora — deep indigo night with a cool blue pulse.
  aurora: {
    id: "aurora",
    label: "Aurora",
    swatch: "#6c8cff",
    colors: {
      base: "#0b1020",
      surface: "#131a2e",
      elevated: "#1b2540",
      textPrimary: "#e8edff",
      textMuted: "#8b97c2",
      border: "#2c3658",
      accent: "#6c8cff",
      hover: "rgba(108, 140, 255, 0.14)",
      bubbleSent: "#19223e",
      bubbleReceived: "#131a2e",
      unreadBadge: "#6c8cff",
      onAccent: "#0b1020",
      online: "#57e08b",
    },
  },

  // Daylight — a calm light theme for daytime use.
  daylight: {
    id: "daylight",
    label: "Daylight",
    swatch: "#2f6df6",
    colors: {
      base: "#f5f7fb",
      surface: "#ffffff",
      elevated: "#eef1f7",
      textPrimary: "#1b2030",
      textMuted: "#6b7488",
      border: "#d7dce8",
      accent: "#2f6df6",
      hover: "rgba(47, 109, 246, 0.10)",
      bubbleSent: "#cfe0ff",
      bubbleReceived: "#ffffff",
      unreadBadge: "#2f6df6",
      onAccent: "#ffffff",
      online: "#2bbd6a",
    },
  },
  midnightOcean: {
    id: "midnightOcean",
    label: "Midnight Ocean",
    swatch: "#38bdf8",
    colors: {
      base: "#020617",
      surface: "#0f172a",
      elevated: "#172554",
      textPrimary: "#e0f2fe",
      textMuted: "#7dd3fc",
      border: "#1e3a5f",
      accent: "#38bdf8",
      hover: "rgba(56, 189, 248, 0.12)",
      bubbleSent: "#102a3d",
      bubbleReceived: "#0f172a",
      unreadBadge: "#38bdf8",
      onAccent: "#020617",
      online: "#22c55e",
    },
  },

  roseQuartz: {
    id: "roseQuartz",
    label: "Rose Quartz",
    swatch: "#fb7185",
    colors: {
      base: "#1a0b12",
      surface: "#241019",
      elevated: "#321522",
      textPrimary: "#ffe4e6",
      textMuted: "#d88b9a",
      border: "#5b2b3a",
      accent: "#fb7185",
      hover: "rgba(251, 113, 133, 0.12)",
      bubbleSent: "#2e1622",
      bubbleReceived: "#241019",
      unreadBadge: "#fb7185",
      onAccent: "#1a0b12",
      online: "#4ade80",
    },
  },

  amberForge: {
    id: "amberForge",
    label: "Amber Forge",
    swatch: "#f59e0b",
    colors: {
      base: "#120d05",
      surface: "#1f1608",
      elevated: "#2c200d",
      textPrimary: "#fff3d1",
      textMuted: "#c9a96a",
      border: "#5c4520",
      accent: "#f59e0b",
      hover: "rgba(245, 158, 11, 0.13)",
      bubbleSent: "#2a1e0c",
      bubbleReceived: "#1f1608",
      unreadBadge: "#f59e0b",
      onAccent: "#120d05",
      online: "#84cc16",
    },
  },

  violetNebula: {
    id: "violetNebula",
    label: "Violet Nebula",
    swatch: "#a78bfa",
    colors: {
      base: "#0f0818",
      surface: "#1a1026",
      elevated: "#261638",
      textPrimary: "#f3e8ff",
      textMuted: "#b69acb",
      border: "#49365f",
      accent: "#a78bfa",
      hover: "rgba(167, 139, 250, 0.14)",
      bubbleSent: "#241636",
      bubbleReceived: "#1a1026",
      unreadBadge: "#a78bfa",
      onAccent: "#0f0818",
      online: "#34d399",
    },
  },

  arctic: {
    id: "arctic",
    label: "Arctic",
    swatch: "#e2e8f0",
    colors: {
      base: "#101820",
      surface: "#18232d",
      elevated: "#22303c",
      textPrimary: "#f1f5f9",
      textMuted: "#94a3b8",
      border: "#3b4a57",
      accent: "#e2e8f0",
      hover: "rgba(226, 232, 240, 0.10)",
      bubbleSent: "#1c2c38",
      bubbleReceived: "#18232d",
      unreadBadge: "#e2e8f0",
      onAccent: "#101820",
      online: "#2dd4bf",
    },
  },
};

export const themeOrder = ["replit", "replitInk", "phosphor", "aurora", "daylight", "midnightOcean", "roseQuartz", "amberForge", "violetNebula", "arctic"];
export const defaultThemeId = "replit";
export const THEME_STORAGE_KEY = "kivo:theme";

// Flat map of CSS custom property name -> value for a given theme id.
export function cssVarsFor(themeId) {
  const theme = themes[themeId] || themes[defaultThemeId];
  return {
    "--bg-base": theme.colors.base,
    "--bg-surface": theme.colors.surface,
    "--bg-elevated": theme.colors.elevated,
    "--text-primary": theme.colors.textPrimary,
    "--text-muted": theme.colors.textMuted,
    "--border": theme.colors.border,
    "--accent": theme.colors.accent,
    "--hover": theme.colors.hover,
    "--bubble-sent": theme.colors.bubbleSent,
    "--bubble-received": theme.colors.bubbleReceived,
    "--unread-badge": theme.colors.unreadBadge,
    "--on-accent": theme.colors.onAccent,
    "--online": theme.colors.online,
    "--scrollbar-thumb": theme.colors.border,
    "--scrollbar-thumb-hover": theme.colors.accent,
  };
}
