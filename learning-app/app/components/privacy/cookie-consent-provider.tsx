"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { COOKIE_CONSENT_MAX_AGE, COOKIE_CONSENT_NAME, type CookieConsent, readCookieConsent, serializeCookieConsent } from "@/app/lib/cookie-consent";
import { CookieConsentBanner } from "@/app/components/privacy/cookie-consent-banner";
import { CookiePreferencesDialog } from "@/app/components/privacy/cookie-preferences-dialog";

export type PromptSurface = "help" | "install";
type CookieConsentContextValue = {
  consent: CookieConsent | null;
  ready: boolean;
  activePrompt: PromptSurface | null;
  requestPrompt: (prompt: PromptSurface) => boolean;
  releasePrompt: (prompt: PromptSurface) => void;
  openSettings: () => void;
};
const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

function cookieValue(name: string) {
  return document.cookie.split("; ").find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1);
}

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const ready = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const [savedConsent, setSavedConsent] = useState<CookieConsent | null | undefined>(undefined);
  const consent = savedConsent === undefined && ready ? readCookieConsent(cookieValue(COOKIE_CONSENT_NAME)) : savedConsent ?? null;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activePrompt, setActivePrompt] = useState<PromptSurface | null>(null);
  const activePromptRef = useRef<PromptSurface | null>(null);

  const requestPrompt = useCallback((prompt: PromptSurface) => {
    if (!ready || !consent || settingsOpen) return false;
    if (activePromptRef.current && activePromptRef.current !== prompt) return false;
    activePromptRef.current = prompt;
    setActivePrompt(prompt);
    return true;
  }, [consent, ready, settingsOpen]);

  const releasePrompt = useCallback((prompt: PromptSurface) => {
    if (activePromptRef.current !== prompt) return;
    activePromptRef.current = null;
    setActivePrompt(null);
  }, []);

  const save = useCallback((choices: Pick<CookieConsent, "analytics" | "advertising">) => {
    const next = serializeCookieConsent(choices);
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE_CONSENT_NAME}=${encodeURIComponent(JSON.stringify(next))}; Path=/; Max-Age=${COOKIE_CONSENT_MAX_AGE}; SameSite=Lax${secure}`;
    setSavedConsent(next);
    setSettingsOpen(false);
  }, []);

  const value = useMemo(() => ({ consent, ready, activePrompt, requestPrompt, releasePrompt, openSettings: () => setSettingsOpen(true) }), [consent, ready, activePrompt, requestPrompt, releasePrompt]);
  return <CookieConsentContext.Provider value={value}>{children}{ready && !consent && <CookieConsentBanner onAccept={() => save({ analytics: true, advertising: true })} onReject={() => save({ analytics: false, advertising: false })} onManage={() => setSettingsOpen(true)} />}{settingsOpen && <CookiePreferencesDialog initialConsent={consent} onClose={() => setSettingsOpen(false)} onSave={save} />}</CookieConsentContext.Provider>;
}

export function useCookieConsent() {
  const context = useContext(CookieConsentContext);
  if (!context) throw new Error("useCookieConsent must be used within CookieConsentProvider");
  return context;
}
