"use client";

import Link from "next/link";

export function CookieConsentBanner({ onAccept, onReject, onManage }: { onAccept: () => void; onReject: () => void; onManage: () => void }) {
  return <aside className="cookie-consent-banner" role="region" aria-label="Cookie choices">
    <div><p className="eyebrow">Privacy choices</p><h2>We value your privacy.</h2><p>Growvelt uses essential cookies and similar technologies to keep the platform secure, maintain your session, and provide important features. With your permission, we may also use optional analytics and advertising technologies if they are enabled in the future.</p><Link href="/cookie-policy">Read our Cookie Policy</Link></div>
    <div className="cookie-consent-actions"><button className="button button-primary" type="button" onClick={onAccept}>Accept Optional</button><button className="button button-secondary" type="button" onClick={onReject}>Reject Optional</button><button className="text-button" type="button" onClick={onManage}>Manage Preferences</button></div>
  </aside>;
}
