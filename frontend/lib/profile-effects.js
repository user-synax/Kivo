// Kivo Plus profile effects — small presence flourishes rendered on profile
// pages (public /u/username, profile drawers, own profile). Only the effect
// id is persisted on the user (User.profileEffect); these helpers map it to
// the CSS classes that animate the avatar halo and/or the display name.
// CSS lives at the end of globals.css (.kivo-pfx-*).

export const PROFILE_EFFECTS = [
  {
    id: "none",
    label: "None",
    hint: "clean & classic",
  },
  {
    id: "glow",
    label: "Glow",
    hint: "soft avatar halo",
  },
  {
    id: "gradient-name",
    label: "Gradient name",
    hint: "animated color-shift name",
  },
  {
    id: "aura",
    label: "Aura",
    hint: "glow + gradient name",
  },
];

export const PROFILE_EFFECT_MAP = Object.fromEntries(
  PROFILE_EFFECTS.map((e) => [e.id, e]),
);

export function getProfileEffect(id) {
  return PROFILE_EFFECT_MAP[id] || PROFILE_EFFECTS[0];
}

// Class to add to the element wrapping the avatar (drives the halo pulse).
export function effectAvatarClass(effect) {
  return effect === "glow" || effect === "aura" ? "kivo-pfx-avatar" : "";
}

// Class to add to the display-name element (drives the gradient text).
export function effectNameClass(effect) {
  return effect === "gradient-name" || effect === "aura" ? "kivo-pfx-name" : "";
}
