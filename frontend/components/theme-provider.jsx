"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getSession } from "@/lib/auth";
import {
  cssVarsForColors,
  customIsActive,
  defaultThemeId,
  derivePalette,
  THEME_STORAGE_KEY,
  themeOrder,
  themes,
} from "@/lib/theme";
import {
  defaultUiStyleId,
  isValidUiStyle,
  SKIN_BODY_VARS,
  skinVarsFor,
  UI_STYLE_ORDER,
  UI_STYLE_STORAGE_KEY,
  UI_STYLES,
} from "@/lib/ui-styles";

const ThemeContext = createContext(null);

export function useTheme() {
  return useContext(ThemeContext);
}

// Provides the active theme + a switcher, and applies the theme's colors as CSS
// custom properties at the root of /app. All dashboard components read colors
// ONLY through these variables (e.g. bg-[var(--bg-elevated)]).
//
// Custom themes are an overlay on top of whichever preset is active: the user's
// account stores an { accent, tint } pair (see `appearance` on the User model),
// applied via derivePalette(). While the theme studio is being edited, `preview`
// carries a transient draft so the whole app re-skins live before anything is
// saved. Logged-in users always get their account colors; guests get presets.
//
// Interface style (`uiStyleId`) is orthogonal to color: `default` keeps the
// Framer geometry, the other skins swap radius/border/shadow language via
// skinVarsFor() + app/app/ui-skins.css. Persisted in localStorage only (no
// backend field), scoped to /app via `data-ui` so landing pages never match.
export function ThemeProvider({ children }) {
  const [themeId, setThemeIdState] = useState(defaultThemeId);
  const [uiStyleId, setUiStyleIdState] = useState(defaultUiStyleId);
  // Persisted customization: { accent, tint } from the user's account.
  const [custom, setCustom] = useState(null);
  // Transient draft while the studio is open (overrides `custom` until saved
  // or discarded).
  const [preview, setPreviewState] = useState(null);

  // Restore the persisted preset choice + the account's saved colors.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved && themes[saved]) setThemeIdState(saved);
      const savedUi = localStorage.getItem(UI_STYLE_STORAGE_KEY);
      if (savedUi && isValidUiStyle(savedUi)) setUiStyleIdState(savedUi);
    } catch {
      // ignore storage failures
    }
    const session = getSession();
    const appearance = session?.appearance;
    if (customIsActive(appearance)) {
      setCustom({
        accent: appearance.accent || null,
        tint: appearance.tint || null,
      });
    }
  }, []);

  // Overrides applied right now: live draft wins, otherwise the saved colors.
  const overrides = preview ?? custom;

  const value = useMemo(() => {
    const palette = overrides
      ? derivePalette(themes[themeId].colors, overrides)
      : themes[themeId].colors;

    const changeTheme = (id) => {
      if (!themes[id]) return;
      setThemeIdState(id);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, id);
      } catch {
        // ignore
      }
    };

    const changeUiStyle = (id) => {
      if (!isValidUiStyle(id)) return;
      setUiStyleIdState(id);
      try {
        localStorage.setItem(UI_STYLE_STORAGE_KEY, id);
      } catch {
        // ignore
      }
    };

    // The theme studio pushes a draft while the user tweaks colors.
    const previewColors = (draft) => {
      const normalized =
        draft && (draft.accent || draft.tint)
          ? { accent: draft.accent || null, tint: draft.tint || null }
          : null;
      setPreviewState(normalized);
    };

    // Commit saved/cleared account colors after the API call succeeds.
    const applyCustom = (next) => {
      setCustom(
        next && (next.accent || next.tint)
          ? { accent: next.accent || null, tint: next.tint || null }
          : null,
      );
      setPreviewState(null);
    };

    return {
      themeId,
      // The preset theme (structure / ink / light-dark family).
      theme: themes[themeId],
      themes: themeOrder.map((id) => themes[id]),
      setThemeId: changeTheme,
      // Interface style (geometry/elevation skin, orthogonal to color).
      uiStyleId,
      uiStyles: UI_STYLE_ORDER.map((id) =>
        UI_STYLES.find((s) => s.id === id),
      ).filter(Boolean),
      setUiStyleId: changeUiStyle,
      // Customization state (null = preset colors only).
      custom,
      preview,
      previewColors,
      applyCustom,
      isCustom: Boolean(overrides),
      // Live-derived palette colors (handy for swatches/previews).
      colors: palette,
      accentColor: palette.accent,
    };
  }, [themeId, uiStyleId, custom, preview, overrides]);

  const skinVars = useMemo(
    () => skinVarsFor(uiStyleId, value.colors),
    [uiStyleId, value.colors],
  );

  // Mirror data-ui + skin tokens onto <body> while /app is mounted
  // so <body>-portaled surfaces (receipts card, context menus, modals) match
  // the skin. Only /app mounts this provider — landing/marketing never gets
  // the attribute or the vars. Cleanup removes everything on unmount
  // (navigation back to marketing), so nothing leaks outside /app.
  useEffect(() => {
    try {
      if (uiStyleId && uiStyleId !== defaultUiStyleId) {
        document.body.dataset.ui = uiStyleId;
        for (const name of SKIN_BODY_VARS) {
          if (skinVars[name])
            document.body.style.setProperty(name, skinVars[name]);
        }
      } else {
        delete document.body.dataset.ui;
        for (const name of SKIN_BODY_VARS) {
          document.body.style.removeProperty(name);
        }
      }
    } catch {
      // ignore (SSR / storage failures)
    }
    return () => {
      try {
        delete document.body.dataset.ui;
        for (const name of SKIN_BODY_VARS) {
          document.body.style.removeProperty(name);
        }
      } catch {
        // ignore
      }
    };
    // Re-mirror when the softened tokens change (theme / studio draft).
  }, [uiStyleId, skinVars]);

  return (
    <ThemeContext.Provider value={value}>
      <div
        data-ui={uiStyleId}
        style={{ ...cssVarsForColors(value.colors), ...skinVars }}
        className="flex min-h-screen flex-col bg-[var(--bg-base)] text-[var(--text-primary)]"
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export default ThemeProvider;
