"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ShieldCheck, X } from "lucide-react";
import type { CookieConsent } from "@/app/lib/cookie-consent";

export function CookiePreferencesDialog({ initialConsent, onClose, onSave }: { initialConsent: CookieConsent | null; onClose: () => void; onSave: (choices: { analytics: boolean; advertising: boolean }) => void }) {
  const [analytics, setAnalytics] = useState(initialConsent?.analytics ?? false);
  const [advertising, setAdvertising] = useState(initialConsent?.advertising ?? false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled])");
    if (!focusable?.length) return;
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  return <div className="cookie-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="cookie-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="cookie-settings-title" onKeyDown={onKeyDown}>
    <header><span className="cookie-dialog-mark" aria-hidden="true"><ShieldCheck size={25} /></span><button ref={closeRef} type="button" className="cookie-dialog-close" onClick={onClose} aria-label="Close Cookie Settings"><X aria-hidden="true" size={22} /></button></header>
    <div className="cookie-dialog-intro"><h2 id="cookie-settings-title">Cookie preferences</h2><p>Choose which optional technologies Growvelt may use if they are enabled in the future. Essential technologies remain active to keep Growvelt secure and working correctly.</p></div>
    <div className="cookie-choice is-essential"><div><h3>Essential</h3><p>Required for authentication, security, session management, and core Growvelt functionality.</p></div><strong>Always Active</strong></div>
    <label className="cookie-choice"><div><h3>Analytics</h3><p>Allows optional technologies that may be used in the future to understand how Growvelt is used and improve the platform.</p></div><input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} aria-label="Enable optional analytics" /></label>
    <label className="cookie-choice"><div><h3>Advertising</h3><p>Allows optional technologies that may be used in the future to measure advertising performance and improve marketing relevance.</p></div><input type="checkbox" checked={advertising} onChange={(event) => setAdvertising(event.target.checked)} aria-label="Enable optional advertising" /></label>
    <footer><button className="cookie-dialog-cancel" type="button" onClick={onClose}>Cancel</button><button className="button button-primary cookie-dialog-save" type="button" onClick={() => onSave({ analytics, advertising })}>Save Preferences</button></footer>
  </section></div>;
}
