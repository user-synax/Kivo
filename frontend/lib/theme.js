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

const MIDNIGHT = {
    ...FRAMER,
    base: "#0a0e16",
    surface: "#121826",
    elevated: "#182032",
    border: "#26334a",
    scrollbarThumb: "#26334a",
    scrollbarThumbHover: "#36486a",
};

// Graphite — cool, sophisticated slate. Deeper contrast steps between
// surface/elevated than Midnight, for a more premium, "machined metal" feel.
const GRAPHITE = {
    ...FRAMER,
    base: "#0d0f12",
    surface: "#171a1f",
    elevated: "#1f2329",
    border: "#2b3038",
    scrollbarThumb: "#2b3038",
    scrollbarThumbHover: "#3c434e",
};

// Espresso — rich, warm dark canvas with a wider tonal ramp (base → surface →
// elevated → border) than a flat brown, so layers read as genuinely lifted.
const ESPRESSO = {
    ...FRAMER,
    base: "#130e0a",
    surface: "#201811",
    elevated: "#2a2016",
    border: "#3a2c1c",
    scrollbarThumb: "#3a2c1c",
    scrollbarThumbHover: "#5c4527",
};

// Pine — deep forest canvas. Same near-black weight as Framer, with a quiet
// green cast instead of blue/brown, so it reads calm rather than cold.
const PINE = {
    ...FRAMER,
    base: "#0a160f",
    surface: "#12261a",
    elevated: "#183222",
    border: "#264a33",
    scrollbarThumb: "#264a33",
    scrollbarThumbHover: "#366a48",
};

// Plum — deep aubergine canvas. Purple cast with the same tonal ramp weight
// as Espresso, for a moodier, more editorial dark option.
const PLUM = {
    ...FRAMER,
    base: "#100a14",
    surface: "#1c1222",
    elevated: "#26182e",
    border: "#3a2646",
    scrollbarThumb: "#3a2646",
    scrollbarThumbHover: "#5a365b",
};

// Light palettes --------------------------------------------------------
// Same single blue accent, same shape as the dark palettes — only the ink
// relationship inverts: dark text on a light canvas, with the "sent bubble"
// still taking the ink extreme (as white did on dark canvases).
const PORCELAIN = {
    base: "#faf9f7",
    surface: "#ffffff",
    elevated: "#ffffff",
    textPrimary: "#161615",
    textMuted: "#7a7770",
    border: "#e6e3dd",
    accent: "#4ba9e1",
    hover: "rgba(22, 22, 21, 0.05)",
    bubbleSent: "#161615",
    bubbleSentFg: "#faf9f7",
    bubbleReceived: "#f1efe9",
    unreadBadge: "#4ba9e1",
    onAccent: "#090909",
    online: "#22c55e",
    accentSoft: "rgba(75, 169, 225, 0.14)",
    glassHighlight: "rgba(22, 22, 21, 0.04)",
    scrollbarThumb: "#ddd9d0",
    scrollbarThumbHover: "#c9c4b8",
};

const LINEN = {
    ...PORCELAIN,
    base: "#f8f4ec",
    surface: "#fffdf8",
    elevated: "#ffffff",
    textPrimary: "#20180f",
    textMuted: "#8a7c66",
    border: "#e9dfc9",
    hover: "rgba(32, 24, 15, 0.05)",
    bubbleSent: "#20180f",
    bubbleSentFg: "#f8f4ec",
    bubbleReceived: "#f1e8d6",
    glassHighlight: "rgba(32, 24, 15, 0.04)",
    scrollbarThumb: "#e2d5b8",
    scrollbarThumbHover: "#cbb98f",
};

// Mist — cool, blue-gray light canvas. Porcelain's neutral structure with a
// quiet cool cast instead of a warm one, for a crisper, more "studio" feel.
const MIST = {
    ...PORCELAIN,
    base: "#f5f7fa",
    surface: "#ffffff",
    elevated: "#ffffff",
    textPrimary: "#12161c",
    textMuted: "#707a87",
    border: "#dde3ea",
    hover: "rgba(18, 22, 28, 0.05)",
    bubbleSent: "#12161c",
    bubbleSentFg: "#f5f7fa",
    bubbleReceived: "#edf1f5",
    glassHighlight: "rgba(18, 22, 28, 0.04)",
    scrollbarThumb: "#d3dbe3",
    scrollbarThumbHover: "#b3c0cd",
};

// Sage — soft, green-tinted light canvas. Linen's warmth swapped for a muted
// botanical cast, for a calmer, more organic light option.
const SAGE = {
    ...PORCELAIN,
    base: "#f5f7f1",
    surface: "#fbfdf7",
    elevated: "#ffffff",
    textPrimary: "#151d12",
    textMuted: "#79826c",
    border: "#dfe6d4",
    hover: "rgba(21, 29, 18, 0.05)",
    bubbleSent: "#151d12",
    bubbleSentFg: "#f5f7f1",
    bubbleReceived: "#eef2e6",
    glassHighlight: "rgba(21, 29, 18, 0.04)",
    scrollbarThumb: "#d5dec4",
    scrollbarThumbHover: "#b7c49f",
};

export const themes = {
    // Framer — the default dark palette: near-black canvas, white ink, blue signal.
    framer: {
        id: "framer",
        label: "Framer",
        swatch: "#4ba9e1",
        colors: FRAMER,
    },

    // Midnight — deep navy canvas.
    midnight: {
        id: "midnight",
        label: "Midnight",
        swatch: "#4ba9e1",
        colors: MIDNIGHT,
    },

    // Graphite — cool slate, premium metallic depth.
    graphite: {
        id: "graphite",
        label: "Graphite",
        swatch: "#4ba9e1",
        colors: GRAPHITE,
    },

    // Espresso — rich warm dark, deep tonal ramp.
    espresso: {
        id: "espresso",
        label: "Espresso",
        swatch: "#4ba9e1",
        colors: ESPRESSO,
    },

    // Pine — deep forest dark, quiet green cast.
    pine: {
        id: "pine",
        label: "Pine",
        swatch: "#4ba9e1",
        colors: PINE,
    },

    // Plum — deep aubergine dark, moody purple cast.
    plum: {
        id: "plum",
        label: "Plum",
        swatch: "#4ba9e1",
        colors: PLUM,
    },

    // Porcelain — clean, neutral off-white canvas.
    porcelain: {
        id: "porcelain",
        label: "Porcelain",
        swatch: "#4ba9e1",
        colors: PORCELAIN,
    },

    // Linen — warm cream canvas.
    linen: {
        id: "linen",
        label: "Linen",
        swatch: "#4ba9e1",
        colors: LINEN,
    },

    // Mist — cool blue-gray light canvas.
    mist: {
        id: "mist",
        label: "Mist",
        swatch: "#4ba9e1",
        colors: MIST,
    },

    // Sage — soft green-tinted light canvas.
    sage: {
        id: "sage",
        label: "Sage",
        swatch: "#4ba9e1",
        colors: SAGE,
    },
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