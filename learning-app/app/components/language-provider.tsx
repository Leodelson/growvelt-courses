"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { localeCookieName, normalizeLocale, translate, type Locale, type TranslationKey } from "@/app/lib/i18n";

type LanguageContextValue = { locale: Locale; setLocale: (locale: Locale) => void; t: (key: TranslationKey) => string };
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState(initialLocale);
  const router = useRouter();
  useEffect(() => {
    const saved = normalizeLocale(document.cookie.split("; ").find((item) => item.startsWith(`${localeCookieName}=`))?.split("=")[1]);
    if (saved === initialLocale) return;
    document.documentElement.lang = saved;
    const timer = window.setTimeout(() => { setLocaleState(saved); router.refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [initialLocale, router]);
  const setLocale = (nextLocale: Locale) => {
    const next = normalizeLocale(nextLocale);
    setLocaleState(next);
    document.cookie = `${localeCookieName}=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = next;
    router.refresh();
  };
  const value = useMemo(() => ({ locale, setLocale, t: (key: TranslationKey) => translate(locale, key) }), [locale]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider.");
  return context;
}
