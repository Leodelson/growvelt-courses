"use client";

import { useContext } from "react";
import { ThemeContext, type Theme } from "@/app/components/theme-provider";

export function ThemeControl() {
  const context = useContext(ThemeContext);
  if (!context) return null;
  return <div className="theme-control" role="group" aria-label="Appearance preference">{(["light", "dark", "system"] as Theme[]).map((option) => <button className={context.theme === option ? "is-active" : ""} key={option} type="button" aria-pressed={context.theme === option} onClick={() => context.setTheme(option)}>{option[0].toUpperCase() + option.slice(1)}</button>)}</div>;
}
