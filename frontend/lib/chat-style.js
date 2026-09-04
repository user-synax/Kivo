// Chat appearance ("chat look"): the wallpaper pattern behind the message list
// and the bubble style of the bubbles themselves. Mirrors the color palette
// mechanics — stored as enum ids on `appearance` (user or Space), applied as
// CSS on the chat container. Space channels may override the member's own look
// per-field (null = inherit the member's preference), exactly like Space
// palettes inherit colors.
//
// Wallpaper patterns are painted with color-mix() over the theme's own
// variables (--text-primary / --accent), so they re-tint automatically for
// dark/light presets and for per-Space palettes — no extra color state.

export const WALLPAPER_OPTIONS = [
  { id: "none", label: "Plain", hint: "flat chat background" },
  { id: "dots", label: "Dots", hint: "soft dot grid" },
  { id: "grid", label: "Grid", hint: "fine blueprint grid" },
  { id: "diagonal", label: "Lines", hint: "thin diagonal lines" },
  { id: "bubbles", label: "Bubbles", hint: "soft bubbles at two scales" },
  { id: "wash", label: "Wash", hint: "accent color wash" },
];

export const BUBBLE_STYLE_OPTIONS = [
  { id: "rounded", label: "Rounded", hint: "soft 12px corners — the default" },
  { id: "pill", label: "Pill", hint: "extra-round, airier corners" },
  { id: "squared", label: "Squared", hint: "tight, square corners" },
  { id: "outline", label: "Outlined (mine)", hint: "your messages outlined in accent" },
];

const VALID_WALLPAPERS = new Set(WALLPAPER_OPTIONS.map((o) => o.id));
const VALID_BUBBLE_STYLES = new Set(BUBBLE_STYLE_OPTIONS.map((o) => o.id));

export const WALLPAPER_DEFAULT = "none";
export const BUBBLE_STYLE_DEFAULT = "rounded";

// Normalize a raw appearance object into concrete chat-look values. Unknown
// ids (or null) fall back to the defaults, so a stale client can never crash.
export function chatLook(appearance) {
  const a = appearance || {};
  const wallpaper = VALID_WALLPAPERS.has(a.wallpaper)
    ? a.wallpaper
    : WALLPAPER_DEFAULT;
  const bubbleStyle = VALID_BUBBLE_STYLES.has(a.bubbleStyle)
    ? a.bubbleStyle
    : BUBBLE_STYLE_DEFAULT;
  return { wallpaper, bubbleStyle };
}

// Resolve the look that applies in a chat. Priority is: per-conversation
// (DM/group shared look) > per-Space (its channels) > the member's own
// preference. Each level may leave a field null to inherit the next one down.
export function resolveChatLook({
  conversationAppearance = null,
  spaceAppearance = null,
  personalAppearance = null,
} = {}) {
  return chatLook({
    wallpaper:
      conversationAppearance?.wallpaper ??
      spaceAppearance?.wallpaper ??
      personalAppearance?.wallpaper,
    bubbleStyle:
      conversationAppearance?.bubbleStyle ??
      spaceAppearance?.bubbleStyle ??
      personalAppearance?.bubbleStyle,
  });
}

// CSS for the wallpaper layer. Patterns use color-mix() over theme variables
// so they adapt to the active theme (and any Space palette scope) with zero
// extra state. Returns undefined for "none" so callers can skip the layer.
export function wallpaperCss(wallpaper) {
  const patterned =
    wallpaper === "dots" ||
    wallpaper === "grid" ||
    wallpaper === "diagonal" ||
    wallpaper === "bubbles" ||
    wallpaper === "wash";
  if (!patterned) return undefined;
  const ink = "color-mix(in srgb, var(--text-primary) 7%, transparent)";
  if (wallpaper === "dots") {
    return {
      backgroundImage: `radial-gradient(circle, ${ink} 1.1px, transparent 1.4px)`,
      backgroundSize: "22px 22px",
    };
  }
  if (wallpaper === "grid") {
    return {
      backgroundImage: `repeating-linear-gradient(0deg, ${ink} 0 1px, transparent 1px 26px), repeating-linear-gradient(90deg, ${ink} 0 1px, transparent 1px 26px)`,
      backgroundSize: "26px 26px",
    };
  }
  if (wallpaper === "diagonal") {
    return {
      backgroundImage: `repeating-linear-gradient(45deg, ${ink} 0 1px, transparent 1px 13px)`,
      backgroundSize: "19px 19px",
    };
  }
  if (wallpaper === "bubbles") {
    // Two overlapping dot scales → a soft "bubbles" texture.
    const big = "color-mix(in srgb, var(--text-primary) 5%, transparent)";
    return {
      backgroundImage: `radial-gradient(circle, ${big} 2.1px, transparent 2.8px), radial-gradient(circle, ${ink} 1px, transparent 1.4px)`,
      backgroundSize: "44px 44px, 22px 22px",
      backgroundPosition: "0 0, 11px 11px",
    };
  }
  // wash — a soft accent gradient rather than a repeating pattern
  const accent = "color-mix(in srgb, var(--accent) 5%, transparent)";
  const accentSoft = "color-mix(in srgb, var(--accent) 2%, transparent)";
  return {
    backgroundImage: `linear-gradient(135deg, ${accent} 0%, ${accentSoft} 42%, transparent 72%)`,
  };
}
