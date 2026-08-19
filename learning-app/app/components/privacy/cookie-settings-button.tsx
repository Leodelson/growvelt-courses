"use client";

import { useCookieConsent } from "@/app/components/privacy/cookie-consent-provider";
import { useLanguage } from "@/app/components/language-provider";

export function CookieSettingsButton() {
  const { openSettings } = useCookieConsent();
  const { t } = useLanguage();
  return <button className="growvelt-footer-cookie-settings" type="button" onClick={openSettings}>{t("footer.cookieSettings")}</button>;
}
