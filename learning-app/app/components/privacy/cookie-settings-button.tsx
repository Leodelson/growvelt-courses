"use client";

import { useCookieConsent } from "@/app/components/privacy/cookie-consent-provider";

export function CookieSettingsButton() {
  const { openSettings } = useCookieConsent();
  return <button className="growvelt-footer-cookie-settings" type="button" onClick={openSettings}>Cookie Settings</button>;
}
