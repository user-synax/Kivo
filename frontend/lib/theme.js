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
// All themes share the Replit "warm workshop with coral sparks" identity
// (warm canvas + a single ember-orange accent) but vary in feel.

const REPLIT_COLORS = {
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
  scrollbarThumb: "#dfddd8",
  scrollbarThumbHover: "#898c94",
};

const REPLIT_INK_COLORS = {
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
  scrollbarThumb: "#312e2e",
  scrollbarThumbHover: "#898c94",
};

// Flat / border-driven elevation - Replit's signature "no shadows" look.
const FLAT_SHADOW = { sm: "none", md: "none", lg: "none", xl: "none", "2xl": "none" };

export const themes = {
  // Replit - the default. Warm canvas, large radii, flat & border-driven.
  replit: {
    id: "replit",
    label: "Replit",
    swatch: "#ff3c00",
    colors: REPLIT_COLORS,
    radius: {
      base: "8px",
      cards: "40px",
      buttons: "100px",
      inputs: "8px",
      nav: "9999px",
      badges: "8px",
      pills: "9999px",
      full: "9999px",
    },
    shadow: FLAT_SHADOW,
  },

  // Replit Soft - same warmth, gentle floating elevation + medium radii.
  replitSoft: {
    id: "replitSoft",
    label: "Replit Soft",
    swatch: "#ff764c",
    colors: REPLIT_COLORS,
    radius: {
      base: "10px",
      cards: "28px",
      buttons: "100px",
      inputs: "10px",
      nav: "9999px",
      badges: "10px",
      pills: "9999px",
      full: "9999px",
    },
    shadow: {
      sm: "0 2px 6px -3px rgba(14, 14, 15, 0.12)",
      md: "0 12px 28px -12px rgba(14, 14, 15, 0.18), 0 4px 10px -6px rgba(14, 14, 15, 0.12)",
      lg: "0 18px 36px -16px rgba(14, 14, 15, 0.16)",
    },
  },

  // Replit Crisp - structured & geometric: small radii, hairline shadows.
  replitCrisp: {
    id: "replitCrisp",
    label: "Replit Crisp",
    swatch: "#312e2e",
    colors: REPLIT_COLORS,
    radius: {
      base: "8px",
      cards: "14px",
      buttons: "12px",
      inputs: "8px",
      nav: "10px",
      badges: "6px",
      pills: "12px",
      full: "9999px",
    },
    shadow: {
      sm: "0 1px 1px rgba(14, 14, 15, 0.08)",
      md: "0 1px 2px rgba(14, 14, 15, 0.10)",
      lg: "0 2px 4px rgba(14, 14, 15, 0.10)",
    },
  },

  // Replit Float - bold, pillowy: very large radii + prominent elevation.
  replitFloat: {
    id: "replitFloat",
    label: "Replit Float",
    swatch: "#ffb199",
    colors: REPLIT_COLORS,
    radius: {
      base: "14px",
      cards: "48px",
      buttons: "100px",
      inputs: "14px",
      nav: "9999px",
      badges: "14px",
      pills: "9999px",
      full: "9999px",
    },
    shadow: {
      sm: "0 4px 10px -4px rgba(14, 14, 15, 0.14)",
      md: "0 24px 48px -16px rgba(14, 14, 15, 0.22), 0 8px 16px -10px rgba(14, 14, 15, 0.14)",
      lg: "0 32px 64px -20px rgba(14, 14, 15, 0.24)",
      xl: "0 40px 80px -24px rgba(14, 14, 15, 0.26)",
      "2xl": "0 48px 96px -28px rgba(14, 14, 15, 0.28)",
    },
  },

  // Replit Ink - the dark-preview variant of the default (flat & large radii).
  replitInk: {
    id: "replitInk",
    label: "Replit Ink",
    swatch: "#ff764c",
    colors: REPLIT_INK_COLORS,
    radius: {
      base: "8px",
      cards: "40px",
      buttons: "100px",
      inputs: "8px",
      nav: "9999px",
      badges: "8px",
      pills: "9999px",
      full: "9999px",
    },
    shadow: FLAT_SHADOW,
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
