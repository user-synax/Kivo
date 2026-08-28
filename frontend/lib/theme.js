// Single source of truth for the dashboard theme.
//
// Every visual surface in /app reads its colors from CSS custom properties
// that this object feeds (see components/theme-provider.jsx). Swapping a value
// here re-skins the entire product — no component edits required.
//
// Values come from Design.md (the Phosphor terminal palette). The dashboard is
// intentionally restrained: flat surfaces, 1px hairline borders, no glow.
export const appTheme = {
  colors: {
    base: "#000000", // --bg-base: deepest page canvas (Void Black)
    surface: "#181818", // --bg-surface: primary UI surface (Ground Iron)
    elevated: "#212525", // --bg-elevated: elevated/nav surface (Carbon Veil)
    textPrimary: "#ddffdc", // --text-primary: headings, icon strokes (Phosphor White)
    textMuted: "#8cab87", // --text-muted: body/secondary text (Sage 60)
    border: "#485346", // --border: hairline interactive border (Circuit Border)
    accent: "#7fee64", // --accent: rationed lime (Lime Pulse)
    hover: "rgba(72, 83, 70, 0.18)", // --hover: subtle hover wash (Circuit Border alpha)
    bubbleSent: "#212525", // --bubble-sent: own message (slightly elevated)
    bubbleReceived: "#181818", // --bubble-received: others' message (base surface)
    unreadBadge: "#7fee64", // --unread-badge: status badge fill (Lime Pulse)
    onAccent: "#181818", // --on-accent: text on lime fills (Ground Iron)
  },
};

// Flat map of CSS custom property name -> value, applied by ThemeProvider.
export const themeCssVars = {
  "--bg-base": appTheme.colors.base,
  "--bg-surface": appTheme.colors.surface,
  "--bg-elevated": appTheme.colors.elevated,
  "--text-primary": appTheme.colors.textPrimary,
  "--text-muted": appTheme.colors.textMuted,
  "--border": appTheme.colors.border,
  "--accent": appTheme.colors.accent,
  "--hover": appTheme.colors.hover,
  "--bubble-sent": appTheme.colors.bubbleSent,
  "--bubble-received": appTheme.colors.bubbleReceived,
  "--unread-badge": appTheme.colors.unreadBadge,
  "--on-accent": appTheme.colors.onAccent,
};
