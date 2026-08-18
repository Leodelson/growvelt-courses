"use client";

import { useContext } from "react";
import { useLanguage } from "@/app/components/language-provider";
import { ThemeContext, type Theme } from "@/app/components/theme-provider";

export function ThemeControl() {
  const context = useContext(ThemeContext);
  const { t } = useLanguage();
  if (!context) return null;
  return <div className="theme-control" role="group" aria-label={t("theme.label")}>{(["light", "dark", "system"] as Theme[]).map((option) => <button className={context.theme === option ? "is-active" : ""} key={option} type="button" aria-pressed={context.theme === option} onClick={() => context.setTheme(option)}>{t(`theme.${option}`)}</button>)}</div>;
}
