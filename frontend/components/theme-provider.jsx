"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  cssVarsFor,
  defaultThemeId,
  THEME_STORAGE_KEY,
  themeOrder,
  themes,
} from "@/lib/theme";

const ThemeContext = createContext(null);

export function useTheme() {
  return useContext(ThemeContext);
}

// Provides the active theme + a switcher, and applies the theme's colors as CSS
// custom properties at the root of /app. All dashboard components read colors
// ONLY through these variables (e.g. bg-[var(--bg-elevated)]).
export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(defaultThemeId);

  // Restore the persisted choice on mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved && themes[saved]) setThemeId(saved);
    } catch {
      // ignore storage failures
    }
  }, []);

  const value = useMemo(() => {
    const change = (id) => {
      if (!themes[id]) return;
      setThemeId(id);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, id);
      } catch {
        // ignore
      }
    };
    return {
      themeId,
      theme: themes[themeId],
      themes: themeOrder.map((id) => themes[id]),
      setThemeId: change,
    };
  }, [themeId]);

  return (
    <ThemeContext.Provider value={value}>
      <div
        style={cssVarsFor(themeId)}
        className="flex min-h-screen flex-col bg-[var(--bg-base)] text-[var(--text-primary)]"
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export default ThemeProvider;
