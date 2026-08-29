// Single source of truth for the dashboard themes.
//
// Design.md (Framer dark canvas) is the system: near-black canvas, white ink,
// a single blue signal (#4ba9e1) for links/focus/selection, charcoal surfaces
// (#141414 / #1c1c1c), hairline borders (#262626). Every visual surface in
// /app reads its colors from CSS custom properties fed by these objects (see
// components/theme-provider.jsx). Switching a theme re-skins the product — no
// component edits required. Components must only ever reference design tokens
// through var(--...) / Tailwind utilities, never hardcoded hex.
//
// Geometry (corner radius), elevation (shadows) and the rest of the layout
// language live in globals.css as global design tokens, so the whole product
// keeps one consistent shape across every palette.

// Dark Framer palettes ------------------------------------------------------
// One canvas family, a single blue accent. The only variation is a faint hue
// cast on the canvas so the switcher feels alive without breaking the brand.
const FRAMER = {
    base: "#090909",
    surface: "#141414",
    elevated: "#1c1c1c",
    textPrimary: "#ffffff",
    textMuted: "#999999",
    border: "#262626",
    accent: "#4ba9e1",
    hover: "rgba(255, 255, 255, 0.06)",
    bubbleSent: "#ffffff",
    bubbleSentFg: "#090909",
    bubbleReceived: "#1c1c1c",
    unreadBadge: "#4ba9e1",
    onAccent: "#090909",
    online: "#22c55e",
    accentSoft: "rgba(75, 169, 225, 0.18)",
    glassHighlight: "rgba(255, 255, 255, 0.06)",
    scrollbarThumb: "#2a2a2a",
    scrollbarThumbHover: "#3a3a3a",
};

const CLOUD = {
    ...FRAMER,
    base: "#0b0d12",
    surface: "#14171f",
    elevated: "#1b1f29",
    border: "#283040",
    scrollbarThumb: "#283040",
    scrollbarThumbHover: "#3a4456",
};

const SAND = {
    ...FRAMER,
    base: "#100d0a",
    surface: "#1a1611",
    elevated: "#221d16",
    border: "#2e2820",
    scrollbarThumb: "#2e2820",
    scrollbarThumbHover: "#403a30",
};

const INK = {
    ...FRAMER,
    base: "#0c0c0e",
    surface: "#151517",
    elevated: "#1c1c1f",
    border: "#2a2a2e",
    scrollbarThumb: "#2a2a2e",
    scrollbarThumbHover: "#3a3a40",
};

const MIDNIGHT = {
    ...FRAMER,
    base: "#0a0e16",
    surface: "#121826",
    elevated: "#182032",
    border: "#26334a",
    scrollbarThumb: "#26334a",
    scrollbarThumbHover: "#36486a",
};

export const themes = {
    // Framer — the default dark palette: near-black canvas, white ink, blue signal.
    framer: {
        id: "framer",
        label: "Framer",
        swatch: "#4ba9e1",
        colors: FRAMER,
    },

    // Cloud — cool, slightly blue-tinted canvas.
    cloud: {
        id: "cloud",
        label: "Cloud",
        swatch: "#4ba9e1",
        colors: CLOUD,
    },

    // Sand — faint warm cast on the canvas.
    sand: {
        id: "sand",
        label: "Sand",
        swatch: "#4ba9e1",
        colors: SAND,
    },

    // Ink — neutral near-black.
    ink: {
        id: "ink",
        label: "Ink",
        swatch: "#4ba9e1",
        colors: INK,
    },

    // Midnight — deep navy canvas.
    midnight: {
        id: "midnight",
        label: "Midnight",
        swatch: "#4ba9e1",
        colors: MIDNIGHT,
    },
};

export const themeOrder = ["framer", "cloud", "sand", "ink", "midnight"];
export const defaultThemeId = "framer";
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
        "--bubble-sent-fg": c.bubbleSentFg,
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
