"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Globe } from "lucide-react";
import { LearningIcon } from "@/app/components/learning-icon";
import { LearningMark } from "@/app/components/learning-mark";
import { useLanguage } from "@/app/components/language-provider";
import { languageOptions } from "@/app/lib/i18n";

const jobsHref = "https://www.growvelt.com";

function AccountIcon() {
  return <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></svg>;
}

function useClientReady() {
  return useSyncExternalStore(() => () => undefined, () => true, () => false);
}

function PublicLanguageControl({ mobile = false }: { mobile?: boolean }) {
  const { t, locale, setLocale } = useLanguage();
  const [open, setOpen] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);
  const selected = languageOptions.find((option) => option.code === locale) ?? languageOptions[0];

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (controlRef.current && !controlRef.current.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return <div className={`public-language-control${mobile ? " is-mobile" : ""}`} ref={controlRef}>
    {mobile ? <div className="public-language-label"><Globe aria-hidden="true" size={16} /><span>{t("language.label")}</span></div> : null}
    <button type="button" className="public-language-trigger" aria-expanded={open} aria-haspopup="listbox" aria-label={t("language.label")} onClick={() => setOpen((current) => !current)}>{mobile ? null : <Globe aria-hidden="true" size={18} />}<span>{selected.label}</span><ChevronDown aria-hidden="true" size={17} /></button>
    {open ? <div className="public-language-options" role="listbox" aria-label={t("language.label")}>{languageOptions.map((option) => <button className={locale === option.code ? "is-selected" : ""} type="button" role="option" aria-selected={locale === option.code} onClick={() => { setLocale(option.code); setOpen(false); }} key={option.code}>{option.label}</button>)}</div> : null}
  </div>;
}

export function PublicHeader() {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const clientReady = useClientReady();
  const closeMenu = () => setIsOpen(false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const navigation = <>
    <Link href="/" onClick={closeMenu}>{t("public.home")}</Link>
    <Link href="/learn" onClick={closeMenu}>{t("public.explore")}</Link>
    <Link href="/teach" onClick={closeMenu}>{t("public.teach")}</Link>
    <a href={jobsHref} target="_blank" rel="noreferrer" onClick={closeMenu}>{t("public.hire")}<span className="sr-only"> in a new tab</span></a>
    <div className="public-careers-menu"><strong>{t("public.careers")}</strong><a href={jobsHref} target="_blank" rel="noreferrer" onClick={closeMenu}>{t("public.applyJobs")}<span className="sr-only"> in a new tab</span></a></div>
  </>;

  const mobileNavigation = <>
    <button type="button" className={`mobile-public-nav-backdrop${isOpen ? " is-open" : ""}`} aria-label={t("public.closeMenu")} tabIndex={isOpen ? 0 : -1} onClick={closeMenu} />
    <aside id="mobile-public-navigation" className={`mobile-public-nav${isOpen ? " is-open" : ""}`} aria-hidden={!isOpen}>
      <div className="mobile-public-nav-heading"><LearningMark /><button type="button" aria-label={t("public.closeMenu")} onClick={closeMenu}><LearningIcon name="close" /></button></div>
      <div className="mobile-public-language">
        <PublicLanguageControl mobile />
      </div>
      <nav aria-label="Mobile primary navigation">{navigation}</nav>
      <div className="mobile-public-nav-account"><Link className="button button-outline" href="/sign-up" onClick={closeMenu}>{t("public.signUp")}</Link><Link className="button button-login" href="/sign-in" onClick={closeMenu}>{t("public.logIn")} <span aria-hidden="true">→</span></Link></div>
    </aside>
  </>;

  return <>
    <header className="public-header">
      <div className="section-shell header-inner">
        <LearningMark />
        <nav className="desktop-public-nav" aria-label="Primary navigation">{navigation}</nav>
        <div className="desktop-auth-actions">
          <PublicLanguageControl />
          <Link className="button button-outline" href="/sign-up">{t("public.signUp")}</Link><Link className="button button-login" href="/sign-in">{t("public.logIn")} <span aria-hidden="true"></span></Link>
        </div>
        <div className="mobile-header-controls">
          <button type="button" className="mobile-menu-button" aria-label={isOpen ? t("public.closeMenu") : t("public.openMenu")} aria-expanded={isOpen} aria-controls="mobile-public-navigation" onClick={() => setIsOpen((open) => !open)}><LearningIcon name={isOpen ? "close" : "menu"} /></button>
          <button type="button" className="mobile-account-button" aria-label={isOpen ? t("public.closeMenu") : t("public.openMenu")} aria-expanded={isOpen} aria-controls="mobile-public-navigation" onClick={() => setIsOpen((open) => !open)}><AccountIcon /></button>
        </div>
      </div>
    </header>
    {clientReady ? createPortal(mobileNavigation, document.body) : null}
  </>;
}
