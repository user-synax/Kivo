// Single source of truth for the dashboard themes.
//
// Every visual surface in /app reads its colors from CSS custom properties
// that these objects feed (see components/theme-provider.jsx). Switching a theme
// re-skins the entire product - no component edits required. Components must
// only ever reference design tokens through var(--...) / Tailwind utilities, never
// hardcoded hex.
//
// A theme is no longer just a color swap - it carries the whole *layout* language:
//   - colors:  surface / text / accent palette
//   - radius:   the corner-radius scale (cards, buttons, inputs, pills...)
//   - shadow:   the elevation language (flat & border-driven, or floating)
//
// All themes share the Nexus "Global Transfers" identity (cream canvas +
// a single primary orange accent + gold secondary) but vary in feel.

const NEXUS_LIGHT = {
  base: "#f2ead3",
  surface: "#ffffff",
  elevated: "#ffffff",
  textPrimary: "#111827",
  textMuted: "#4b5563",
  border: "#e5e7eb",
  accent: "#f68b1f",
  hover: "rgba(17, 24, 39, 0.06)",
  bubbleSent: "#f68b1f",
  bubbleReceived: "#ffffff",
  unreadBadge: "#f68b1f",
  onAccent: "#ffffff",
  online: "#16a06a",
  scrollbarThumb: "#d9d0bc",
  scrollbarThumbHover: "#9ca3af",
};

const NEXUS_DARK = {
  base: "#14110b",
  surface: "#1f1b14",
  elevated: "#1f1b14",
  textPrimary: "#f2ead3",
  textMuted: "#b9b2a3",
  border: "#3a3326",
  accent: "#f68b1f",
  hover: "rgba(242, 234, 211, 0.07)",
  bubbleSent: "#f68b1f",
  bubbleReceived: "#2a2419",
  unreadBadge: "#f68b1f",
  onAccent: "#ffffff",
  online: "#16a06a",
  scrollbarThumb: "#3a3326",
  scrollbarThumbHover: "#6b7280",
};

// Subtle elevation — Nexus uses light borders + "HTML-matched" shadow depth
// rather than the old fully-flat look.
const NEXUS_SHADOW = {
  sm: "0 1px 2px rgba(17, 24, 39, 0.06)",
  md: "0 4px 16px -8px rgba(17, 24, 39, 0.12)",
  lg: "0 12px 32px -12px rgba(17, 24, 39, 0.16)",
};

const NEXUS_SHADOW_DARK = {
  sm: "0 1px 2px rgba(0, 0, 0, 0.4)",
  md: "0 4px 16px -8px rgba(0, 0, 0, 0.5)",
  lg: "0 12px 32px -12px rgba(0, 0, 0, 0.55)",
};

export const themes = {
  // Nexus - the default. Cream canvas, 16px cards, pill buttons, subtle elevation.
  replit: {
    id: "replit",
    label: "Nexus",
    swatch: "#f68b1f",
    colors: NEXUS_LIGHT,
    radius: {
      base: "8px",
      cards: "16px",
      buttons: "9999px",
      inputs: "8px",
      nav: "9999px",
      badges: "8px",
      pills: "9999px",
      full: "9999px",
    },
    shadow: NEXUS_SHADOW,
  },

  // Nexus Soft - same warmth, gentle floating elevation + slightly larger cards.
  replitSoft: {
    id: "replitSoft",
    label: "Nexus Soft",
    swatch: "#fdb813",
    colors: NEXUS_LIGHT,
    radius: {
      base: "10px",
      cards: "20px",
      buttons: "9999px",
      inputs: "10px",
      nav: "9999px",
      badges: "10px",
      pills: "9999px",
      full: "9999px",
    },
    shadow: {
      sm: "0 2px 6px -3px rgba(17, 24, 39, 0.12)",
      md: "0 12px 28px -12px rgba(17, 24, 39, 0.18), 0 4px 10px -6px rgba(17, 24, 39, 0.12)",
      lg: "0 18px 36px -16px rgba(17, 24, 39, 0.16)",
    },
  },

  // Nexus Crisp - structured & geometric: small radii, hairline shadows.
  replitCrisp: {
    id: "replitCrisp",
    label: "Nexus Crisp",
    swatch: "#1f2937",
    colors: NEXUS_LIGHT,
    radius: {
      base: "8px",
      cards: "12px",
      buttons: "8px",
      inputs: "8px",
      nav: "10px",
      badges: "6px",
      pills: "10px",
      full: "9999px",
    },
    shadow: {
      sm: "0 1px 1px rgba(17, 24, 39, 0.08)",
      md: "0 1px 2px rgba(17, 24, 39, 0.10)",
      lg: "0 2px 4px rgba(17, 24, 39, 0.10)",
    },
  },

  // Nexus Float - bold, pillowy: larger cards + prominent elevation.
  replitFloat: {
    id: "replitFloat",
    label: "Nexus Float",
    swatch: "#fbe7c2",
    colors: NEXUS_LIGHT,
    radius: {
      base: "14px",
      cards: "24px",
      buttons: "9999px",
      inputs: "14px",
      nav: "9999px",
      badges: "14px",
      pills: "9999px",
      full: "9999px",
    },
    shadow: {
      sm: "0 4px 10px -4px rgba(17, 24, 39, 0.14)",
      md: "0 24px 48px -16px rgba(17, 24, 39, 0.22), 0 8px 16px -10px rgba(17, 24, 39, 0.14)",
      lg: "0 32px 64px -20px rgba(17, 24, 39, 0.24)",
      xl: "0 40px 80px -24px rgba(17, 24, 39, 0.26)",
      "2xl": "0 48px 96px -28px rgba(17, 24, 39, 0.28)",
    },
  },

  // Nexus Ink - the dark variant of the default (subtle elevation + 16px cards).
  replitInk: {
    id: "replitInk",
    label: "Nexus Ink",
    swatch: "#fdb813",
    colors: NEXUS_DARK,
    radius: {
      base: "8px",
      cards: "16px",
      buttons: "9999px",
      inputs: "8px",
      nav: "9999px",
      badges: "8px",
      pills: "9999px",
      full: "9999px",
    },
    shadow: NEXUS_SHADOW_DARK,
  },
};

export const themeOrder = ["replit", "replitSoft", "replitCrisp", "replitFloat", "replitInk"];
export const defaultThemeId = "replit";
export const THEME_STORAGE_KEY = "kivo:theme";

// Flat map of CSS custom property name -> value for a given theme id.
// Colors, the radius scale, and the elevation language are all injected at the
// root so the entire product (marketing chrome + dashboard) re-skins at once.
export function cssVarsFor(themeId) {
  const theme = themes[themeId] || themes[defaultThemeId];
  const { colors: c, radius: r, shadow: s } = theme;
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
    "--scrollbar-thumb": c.scrollbarThumb,
    "--scrollbar-thumb-hover": c.scrollbarThumbHover,

    // Layout: corner-radius scale
    "--radius": r.base,
    "--radius-cards": r.cards,
    "--radius-buttons": r.buttons,
    "--radius-inputs": r.inputs,
    "--radius-nav": r.nav,
    "--radius-badges": r.badges,
    "--radius-pills": r.pills,
    "--radius-full": r.full,

    // Layout: elevation language
    "--shadow-sm": s.sm || "none",
    "--shadow-md": s.md || "none",
    "--shadow-lg": s.lg || "none",
    "--shadow-xl": s.xl || "none",
    "--shadow-2xl": s["2xl"] || "none",
  };
}
