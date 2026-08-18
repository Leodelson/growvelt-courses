"use client";

import { useLanguage } from "@/app/components/language-provider";
import { languageOptions } from "@/app/lib/i18n";

export function LanguageControl() {
  const { locale, setLocale, t } = useLanguage();
  return <label className="language-control"><span className="sr-only">{t("language.label")}</span><select value={locale} onChange={(event) => setLocale(event.target.value as typeof locale)}>{languageOptions.map((language) => <option value={language.code} key={language.code}>{language.label}</option>)}</select></label>;
}
