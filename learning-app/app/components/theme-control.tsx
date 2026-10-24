"use client";

import { useContext } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useLanguage } from "@/app/components/language-provider";
import { ThemeContext, type Theme } from "@/app/components/theme-provider";
import styles from "./theme-control.module.css";

const themeIcons = { light: Sun, dark: Moon, system: Monitor };

export function ThemeControl({ variant = "compact" }: { variant?: "compact" | "cards" }) {
  const context = useContext(ThemeContext);
  const { t } = useLanguage();
  if (!context) return null;
  return <div className={`theme-control ${variant === "cards" ? styles.cards : ""}`} role="group" aria-label={t("theme.label")}>{(["light", "dark", "system"] as Theme[]).map((option) => {
    const selected = context.theme === option;
    if (variant === "compact") return <button className={selected ? "is-active" : ""} key={option} type="button" aria-pressed={selected} onClick={() => context.setTheme(option)}>{t(`theme.${option}`)}</button>;
    const Icon = themeIcons[option];
    return <button className={styles.option} key={option} type="button" aria-pressed={selected} onClick={() => context.setTheme(option)}>
      <span className={`${styles.preview} ${styles[`${option}Preview`]}`} aria-hidden="true"><i /><i /><i /></span>
      <span className={styles.optionLabel}><Icon size={17} aria-hidden="true" />{t(`theme.${option}`)}</span>
      {selected && <span className={styles.selected} aria-hidden="true"><Check size={13} /></span>}
    </button>;
  })}</div>;
}
