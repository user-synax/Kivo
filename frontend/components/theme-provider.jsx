"use client";

import { themeCssVars } from "@/lib/theme";

// Applies the single theme object as CSS custom properties at the root of /app.
// All dashboard components consume colors ONLY through these variables
// (e.g. bg-[var(--bg-elevated)]), never hardcoded hex.
export function ThemeProvider({ children }) {
  return (
    <div
      style={themeCssVars}
      className="flex min-h-screen flex-col bg-[var(--bg-base)] text-[var(--text-primary)]"
    >
      {children}
    </div>
  );
}

export default ThemeProvider;
