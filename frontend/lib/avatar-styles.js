// Avatar border customization presets. The id is the only thing persisted
// (User.avatarStyle on the backend); the client maps it to a color or gradient.
// Gradient presets are intentionally STATIC — no glow, no animation — per the
// product spec, so they read as a calm ring rather than a moving light.
export const AVATAR_STYLES = [
  { id: "default", label: "Default", kind: "solid", color: null },
  { id: "lime", label: "Lime", kind: "solid", color: "#7fee64" },
  { id: "blue", label: "Blue", kind: "solid", color: "#6c8cff" },
  { id: "rose", label: "Rose", kind: "solid", color: "#fb7185" },
  { id: "amber", label: "Amber", kind: "solid", color: "#f59e0b" },
  { id: "violet", label: "Violet", kind: "solid", color: "#a78bfa" },
  { id: "ocean", label: "Ocean", kind: "solid", color: "#38bdf8" },
  {
    id: "grad-sunset",
    label: "Sunset",
    kind: "gradient",
    gradient: "linear-gradient(135deg, #f59e0b 0%, #fb7185 100%)",
  },
  {
    id: "grad-aurora",
    label: "Aurora",
    kind: "gradient",
    gradient: "linear-gradient(135deg, #38bdf8 0%, #a78bfa 100%)",
  },
];

export const AVATAR_STYLE_MAP = Object.fromEntries(
  AVATAR_STYLES.map((s) => [s.id, s]),
);

// Resolve an avatarStyle id to its preset, falling back to the default border.
export function getAvatarStyle(id) {
  return AVATAR_STYLE_MAP[id] || AVATAR_STYLES[0];
}
