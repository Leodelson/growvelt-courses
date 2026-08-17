export const COOKIE_CONSENT_NAME = "growvelt_cookie_consent";
export const COOKIE_CONSENT_VERSION = 1;
export const COOKIE_CONSENT_MAX_AGE = 60 * 60 * 24 * 180;

export type CookieConsent = {
  version: number;
  analytics: boolean;
  advertising: boolean;
  updatedAt: string;
};

export function readCookieConsent(cookieValue: string | undefined): CookieConsent | null {
  if (!cookieValue) return null;
  try {
    const value = JSON.parse(decodeURIComponent(cookieValue)) as Partial<CookieConsent>;
    if (value.version !== COOKIE_CONSENT_VERSION || typeof value.analytics !== "boolean" || typeof value.advertising !== "boolean" || typeof value.updatedAt !== "string") return null;
    return { version: COOKIE_CONSENT_VERSION, analytics: value.analytics, advertising: value.advertising, updatedAt: value.updatedAt };
  } catch {
    return null;
  }
}

export function serializeCookieConsent(choices: Pick<CookieConsent, "analytics" | "advertising">): CookieConsent {
  return { version: COOKIE_CONSENT_VERSION, analytics: choices.analytics, advertising: choices.advertising, updatedAt: new Date().toISOString() };
}
