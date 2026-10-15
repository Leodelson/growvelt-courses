"use client";

import { useContext, useState, type ReactNode } from "react";
import { ThemeContext } from "@/app/components/theme-provider";
import { useLanguage } from "@/app/components/language-provider";
import { accountCopy } from "@/app/lib/learning/account-workspace";
import styles from "./account-workspace.module.css";

export function AccountSections({ sections }: { sections: { id: string; title: string; keywords: string; content: ReactNode }[] }) {
  const { locale, t } = useLanguage();
  const theme = useContext(ThemeContext);
  const text = accountCopy[locale];
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const search = query.trim().toLocaleLowerCase(locale);
  const matches = (section: typeof sections[number]) => (category === "all" || category === section.id) && `${section.title} ${section.keywords}`.toLocaleLowerCase(locale).includes(search);
  const count = sections.filter(matches).length;
  function reset() { setQuery(""); setCategory("all"); }
  return <div className={styles.settingsLayout}>
    <aside className={styles.settingsNav} aria-label={text.preferences}>
      <p className="eyebrow">{text.preferences}</p>
      <div role="group" aria-label={text.all}><button type="button" aria-pressed={category === "all"} onClick={() => setCategory("all")}>{text.all}</button>{sections.map((section) => <button type="button" key={section.id} aria-pressed={category === section.id} onClick={() => setCategory(section.id)}>{section.title}</button>)}</div>
      <p className={styles.preferenceNote}>{text.saved}</p>
      <dl className={styles.preferenceSummary}><div><dt>{t("settings.language")}</dt><dd>{locale === "fr" ? "Français" : locale === "es" ? "Español" : "English"}</dd></div>{theme && <div><dt>{t("settings.appearance")}</dt><dd>{t(`theme.${theme.theme}`)}</dd></div>}</dl>
    </aside>
    <div className={styles.stack}>
      <label className={styles.search}>{text.search}<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <div className={styles.resultLine}><p role="status">{text.results}: <strong>{count} / {sections.length}</strong></p>{(query || category !== "all") && <button type="button" onClick={reset}>{text.reset}</button>}</div>
      {count === 0 && <div className={styles.panel}><h2>{text.noMatch}</h2><p>{text.tryAgain}</p></div>}
      {sections.map((section) => <div id={`settings-${section.id}`} key={section.id} hidden={!matches(section)}>{section.content}</div>)}
    </div>
  </div>;
}
