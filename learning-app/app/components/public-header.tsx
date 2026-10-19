"use client";
import { careersAbsoluteUrl } from "@/app/lib/site-urls.mjs";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, BriefcaseBusiness, ChevronDown, Globe, UsersRound } from "lucide-react";
import { LearningIcon } from "@/app/components/learning-icon";
import { LearningMark } from "@/app/components/learning-mark";
import { useLanguage } from "@/app/components/language-provider";
import { languageOptions } from "@/app/lib/i18n";
import { publicExperienceCopy } from "@/app/lib/public-experience-copy";
import styles from "./public-header.module.css";

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

type PublicNavCopy = typeof publicExperienceCopy.en.nav;

export function CareersMenu({ copy, onNavigate }: { copy: PublicNavCopy; onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <div className={styles.careersMenu} ref={menuRef}>
    <button className={styles.careersTrigger} type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <span>{copy.careers}</span><ChevronDown aria-hidden="true" size={16} />
    </button>
    {open ? <div className={styles.careersDropdown}>
      <p className={styles.careersDropdownTitle}>{copy.careersMenuTitle}</p>
      <div className={styles.careersDropdownGroup} role="group" aria-label={copy.careersMenuTitle}>
        <a href={careersAbsoluteUrl("/jobs")} target="_blank" rel="noreferrer" onClick={onNavigate}>
          <span className={styles.careersOptionIcon}><BriefcaseBusiness aria-hidden="true" size={19} /></span>
          <span className={styles.careersOptionCopy}><strong>{copy.findJobs}</strong><small>{copy.findJobsDescription}</small></span>
          <ArrowUpRight className={styles.careersOptionArrow} aria-hidden="true" size={17} />
          <span className="sr-only"> (opens Growvelt Careers in a new tab)</span>
        </a>
        <a href={careersAbsoluteUrl("/")} target="_blank" rel="noreferrer" onClick={onNavigate}>
          <span className={styles.careersOptionIcon}><UsersRound aria-hidden="true" size={19} /></span>
          <span className={styles.careersOptionCopy}><strong>{copy.hireTalent}</strong><small>{copy.hireTalentDescription}</small></span>
          <ArrowUpRight className={styles.careersOptionArrow} aria-hidden="true" size={17} />
          <span className="sr-only"> (opens Growvelt Careers in a new tab)</span>
        </a>
      </div>
    </div> : null}
  </div>;
}

export function PublicHeader({ initialQuery = "" }: { initialQuery?: string }) {
  const { t, locale } = useLanguage();
  const copy = publicExperienceCopy[locale].nav;
  const [isOpen, setIsOpen] = useState(false);
  const clientReady = useClientReady();
  const drawerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeMenu = () => setIsOpen(false);

  useEffect(() => {
    if (!isOpen) return;
    const menuButton = menuButtonRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
      if (event.key !== "Tab") return;
      const controls = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), select, input') ?? []).filter((element) => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", handleKey); menuButton?.focus(); };
  }, [isOpen]);

  const navigation = <>
    <Link href="/learn" onClick={closeMenu}>{copy.explore}</Link>
    <Link href="/teach" onClick={closeMenu}>{copy.teach}</Link>
    <Link href="/company-learning" onClick={closeMenu}>{copy.teams}</Link>
    <CareersMenu copy={copy} onNavigate={closeMenu} />
  </>;

  const mobileNavigation = <div className={styles.mobileOverlay}>
    <button type="button" className={styles.backdrop} aria-label={t("public.closeMenu")} tabIndex={-1} onClick={closeMenu} />
    <aside ref={drawerRef} id="mobile-public-navigation" className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="public-menu-title">
      <div className={styles.drawerHeading}><LearningMark /><button type="button" aria-label={t("public.closeMenu")} onClick={closeMenu}><LearningIcon name="close" /></button></div>
      <p className={styles.menuTitle} id="public-menu-title">{copy.menu}</p>
      <nav aria-label={copy.menu}><Link href="/" onClick={closeMenu}>{t("public.home")}</Link>{navigation}</nav>
      <div className={styles.drawerLanguage}><PublicLanguageControl mobile /></div>
      <div className={styles.drawerActions}><Link className={styles.join} href="/sign-up" onClick={closeMenu}>{t("public.signUp")}</Link><Link className={styles.login} href="/sign-in" onClick={closeMenu}>{t("public.logIn")}</Link></div>
    </aside>
  </div>;

  return <>
    <a className={styles.skip} href="#public-main" onClick={(event) => {
      const main = document.querySelector("main");
      if (!main) return;
      event.preventDefault();
      if (!main.id) main.id = "public-main";
      main.tabIndex = -1;
      main.focus();
      main.scrollIntoView({ block: "start" });
    }}>{copy.skip}</a>
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.brand}><LearningMark /></div>
        <form className={styles.search} action="/learn" method="get" role="search" aria-label={copy.search}>
          <label className="sr-only" htmlFor="public-course-search">{copy.search}</label>
          <input key={initialQuery} id="public-course-search" type="search" name="q" defaultValue={initialQuery} placeholder={copy.placeholder} maxLength={120} />
          <button type="submit" aria-label={copy.search}><LearningIcon name="explore" size={21} /></button>
        </form>
        <nav className={styles.navigation} aria-label={copy.menu}>{navigation}</nav>
        <div className={styles.account}>
          <div className={styles.language}><PublicLanguageControl /></div>
          <Link className={styles.login} href="/sign-in">{t("public.logIn")}</Link>
          <Link className={styles.join} href="/sign-up">{t("public.signUp")}</Link>
        </div>
        <button ref={menuButtonRef} type="button" className={styles.menuButton} aria-label={isOpen ? t("public.closeMenu") : t("public.openMenu")} aria-expanded={isOpen} aria-controls="mobile-public-navigation" onClick={() => setIsOpen((open) => !open)}><LearningIcon name={isOpen ? "close" : "menu"} /></button>
      </div>
    </header>
    {clientReady && isOpen ? createPortal(mobileNavigation, document.body) : null}
  </>;
}
