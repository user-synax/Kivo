// Profile "skin" helpers — let a public /u/username page render in the OWNER's
// appearance (accent + canvas tint) instead of the fixed default palette.
//
// The profile components (ProfileContent, drawers, /u pages) read the legacy
// `:root` tokens --canvas/--ink/--surface-1/--hairline/--accent-blue. The
// dashboard themes instead define a parallel namespace (--bg-base etc.) on a
// wrapper div. This module converts a theme palette back into the legacy token
// names so a scoped wrapper can re-skin the profile subtree with plain CSS
// variables — no component edits required.
import { defaultThemeId, derivePalette, themes } from "./theme.js";

// Map a theme colors object onto the profile namespace. All keys are optional
// (a partial override keeps the :root default for anything unset).
export function profileSkinVars(colors) {
  if (!colors) return null;
  return {
    "--canvas": colors.base,
    "--surface-1": colors.surface,
    "--surface-2": colors.elevated,
    "--hairline": colors.border,
    "--hairline-soft": colors.border,
    "--ink": colors.textPrimary,
    "--ink-muted": colors.textMuted,
    "--accent-blue": colors.accent,
    // shadcn layer used sparsely by the profile subtree (badge, graph):
    "--background": colors.base,
    "--foreground": colors.textPrimary,
    "--card": colors.surface,
    "--card-foreground": colors.textPrimary,
    "--popover": colors.elevated,
    "--popover-foreground": colors.textPrimary,
    "--primary": colors.textPrimary,
    "--primary-foreground": colors.base,
    "--secondary": colors.elevated,
    "--secondary-foreground": colors.textPrimary,
    "--muted": colors.elevated,
    "--muted-foreground": colors.textMuted,
    "--accent": colors.elevated,
    "--border": colors.border,
    "--input": colors.border,
    "--ring": colors.accent,
    "--destructive": "#ff5577",
  };
}

// Resolve a user's full visual identity: their stored appearance (accent +
// canvas tint from the account) layered over their active preset theme.
// appearance.shape is { accent, tint, wallpaper?, bubbleStyle? } — exactly the
// shape the backend serializes. Visitors without an owner appearance get null,
// meaning the default :root palette applies untouched.
export function ownerSkin(appearance) {
  if (!appearance) return null;
  const accent = appearance.accent || null;
  const tint = appearance.tint || null;
  if (!accent && !tint) return null;
  const base = themes[defaultThemeId].colors;
  const derived = derivePalette(base, { accent, tint });
  return profileSkinVars(derived);
}
