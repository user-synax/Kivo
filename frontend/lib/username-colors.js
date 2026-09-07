// Kivo Plus custom username color — displayed on name pills in group chat
// and member lists (like Discord Nitro). Free users always render as
// `text-muted`; Plus users with a hex get that color, otherwise a gradient.
//
// Only the hex is persisted on the User (User.usernameColor); rendering is
// entirely client-driven via these helpers + CSS in globals.css (kivo-username-*).

export const USERNAME_COLOR_PRESETS = [
  "#ff2e7a", // pink
  "#ff7a3d", // orange
  "#f59e0b", // amber
  "#facc15", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#38bdf8", // sky
  "#6c8cff", // blue
  "#a78bfa", // violet
  "#d44df0", // magenta
  "#fb7185", // rose
  "#e879f9", // fuchsia
];

export function isValidHex(hex) {
  return typeof hex === "string" && /^#[0-9a-fA-F]{6}$/.test(hex);
}

// Normalize "#FF5500" -> "#ff5500" or null if invalid/empty.
export function normalizeHex(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;
  if (!isValidHex(s)) return null;
  return s.toLowerCase();
}

// Style object for an inline name pill.
// - Free or no color: returns {} so the caller falls back to text-muted.
// - Plus with hex: returns { color: hex }.
// - Plus without color: caller should apply the gradient class instead.
export function usernameColorStyle(user, isPlus) {
  const plus = isPlus ?? (user?.isPlus || user?.plan === "plus");
  if (!plus) return {};
  const hex = user?.usernameColor || null;
  if (hex && isValidHex(hex)) return { color: hex };
  return {};
}

// Whether to apply the Plus gradient (Plus user with no custom hex).
export function shouldUsePlusGradient(user, isPlus) {
  const plus = isPlus ?? (user?.isPlus || user?.plan === "plus");
  if (!plus) return false;
  const hex = user?.usernameColor || null;
  return !hex || !isValidHex(hex);
}

export function usernameColorClass(user, isPlus) {
  return shouldUsePlusGradient(user, isPlus) ? "kivo-username-gradient" : "";
}
