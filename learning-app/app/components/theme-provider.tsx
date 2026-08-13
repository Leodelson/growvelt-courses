"use client";

import { createContext, useEffect, useMemo, useState } from "react";

export type Theme = "light" | "dark" | "system";
type ThemeContextValue = { theme: Theme; setTheme: (theme: Theme) => void };
export const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  const resolved = theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : theme === "system" ? "light" : theme;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  useEffect(() => {
    const stored = window.localStorage.getItem("growvelt-learning-theme") as Theme | null;
    const next = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    applyTheme(next);
    const timer = window.setTimeout(() => setThemeState(next), 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { const listener = () => theme === "system" && applyTheme(theme); const query = window.matchMedia("(prefers-color-scheme: dark)"); query.addEventListener("change", listener); return () => query.removeEventListener("change", listener); }, [theme]);
  const setTheme = (next: Theme) => { setThemeState(next); window.localStorage.setItem("growvelt-learning-theme", next); applyTheme(next); };
  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
