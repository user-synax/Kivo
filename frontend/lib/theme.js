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

// ── Custom theme engine ────────────────────────────────────────────────────
// Every theme is a flat palette of tokens. A *custom* theme is an overlay on
// the user's active preset: an accent (links, buttons, badges) and a canvas
// tint that washes the surface family with a color. The wash preserves each
// token's own lightness, so contrast is never broken — re-skinned, not
// re-colored. Choosing "no tint" / "no accent" keeps the preset's values.

// Tokens that belong to the "surface family" — recast by the canvas tint.
// text/ink tokens are excluded on purpose so readability never shifts.
const SURFACE_TOKENS = [
  "base",
  "surface",
  "elevated",
  "border",
  "scrollbarThumb",
  "scrollbarThumbHover",
  "bubbleReceived",
];

// How strongly a chosen tint color washes the surface family. Light themes are
// washed more gently — pastels blow out faster than dark canvases deepen.
function tintStrength(baseColor) {
  const { r, g, b } = parseHex(baseColor) || { r: 0, g: 0, b: 0 };
  const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return l > 0.5 ? 0.14 : 0.2;
}

export function parseHex(input) {
  if (typeof input !== "string") return null;
  let hex = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  const n = parseInt(hex, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// Channel-wise mix of two hex colors toward `t` (0 = a, 1 = b).
export function mixHex(aHex, bHex, t) {
  const a = parseHex(aHex);
  const b = parseHex(bHex);
  if (!a || !b) return aHex;
  const k = Math.min(Math.max(t, 0), 1);
  const c = ["r", "g", "b"].map((ch) =>
    Math.round(a[ch] + (b[ch] - a[ch]) * k),
  );
  return `#${c
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")
    .toLowerCase()}`;
}

// WCAG-style relative luminance (0..1) for a hex color.
export function hexLuminance(input) {
  const rgb = parseHex(input);
  if (!rgb) return 0;
  const lin = [rgb.r, rgb.g, rgb.b].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

// Is the color "chromatic" enough to wash with? Near-grays/black/white carry
// no useful hue, so they count as "no tint".
function isChromatic(input) {
  const rgb = parseHex(input);
  if (!rgb) return false;
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  const delta = max - min;
  if (delta < 24) return false;
  const l = (max + min) / 2;
  // Very dark or very light colors read as neutrals even if slightly tinted.
  return l > 40 && l < 215;
}

export function rgba(hex, alpha) {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

// Build a full palette from a preset's colors + custom overrides.
export function derivePalette(baseColors, { accent = null, tint = null } = {}) {
  const colors = { ...baseColors };
  const tintHex =
    tint && isChromatic(tint) ? mixHex(tint, "#ffffff", 0.06) : null;
  if (tintHex) {
    const k = tintStrength(baseColors.base);
    for (const token of SURFACE_TOKENS) {
      colors[token] = mixHex(colors[token], tintHex, k);
    }
  }
  if (accent && parseHex(accent)) {
    colors.accent = accent;
    colors.unreadBadge = accent;
    colors.accentSoft = rgba(accent, 0.16);
    colors.onAccent = hexLuminance(accent) > 0.45 ? "#0a0a0a" : "#ffffff";
  }
  return colors;
} // Curated accent swatches for the theme studio (work on dark & light themes).
// The theme's own accent is offered separately as the "default" swatch, so the
// brand blue is not duplicated here.
export const ACCENT_PRESETS = [
  "#7dd3fc", // sky
  "#6366f1", // indigo
  "#a78bfa", // violet
  "#e879f9", // fuchsia
  "#fb7185", // rose
  "#fb923c", // orange
  "#facc15", // amber
  "#34d399", // emerald
  "#2dd4bf", // teal
];

// Curated canvas tints for the theme studio. "Neutral" (null) keeps the
// preset theme's own canvas.
export const TINT_PRESETS = [
  { label: "Neutral", hex: null },
  { label: "Ember", hex: "#e11d48" },
  { label: "Sunkissed", hex: "#f97316" },
  { label: "Amber", hex: "#f59e0b" },
  { label: "Olive", hex: "#a3e635" },
  { label: "Emerald", hex: "#10b981" },
  { label: "Lagoon", hex: "#14b8a6" },
  { label: "Sky", hex: "#0ea5e9" },
  { label: "Indigo", hex: "#6366f1" },
  { label: "Orchid", hex: "#a855f7" },
];

// A custom override is "active" when it would visibly change the preset.
export function customIsActive(custom) {
  if (!custom) return false;
  return Boolean(custom.accent || (custom.tint && isChromatic(custom.tint)));
}

// Flat map of CSS custom property name -> value for a given preset theme id,
// optionally layered with custom overrides (accent + canvas tint).
// Only color tokens are injected here; radius + shadow are global design tokens
// in globals.css, so the geometry of the UI never changes between themes.
export function cssVarsFor(themeId, overrides) {
  const theme = themes[themeId] || themes[defaultThemeId];
  const c = overrides ? derivePalette(theme.colors, overrides) : theme.colors;
  return cssVarsForColors(c);
}

// Same as cssVarsFor but from an already-derived colors object.
export function cssVarsForColors(c) {
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
