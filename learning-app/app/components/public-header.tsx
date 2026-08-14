"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { LearningIcon } from "@/app/components/learning-icon";
import { LearningMark } from "@/app/components/learning-mark";

const jobsHref = "https://growvelt.com";

function AccountIcon() {
  return <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></svg>;
}

function useClientReady() {
  return useSyncExternalStore(() => () => undefined, () => true, () => false);
}

export function PublicHeader() {
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
    <Link href="/" onClick={closeMenu}>Home</Link>
    <Link href="/learn" onClick={closeMenu}>Explore Learning</Link>
    <Link href="/sign-up?next=%2Fteach%2Fapplication" onClick={closeMenu}>Teach on Growvelt</Link>
    <div className="public-careers-menu"><strong>Careers</strong><a href={jobsHref} target="_blank" rel="noreferrer" onClick={closeMenu}>Apply for jobs<span className="sr-only"> in a new tab</span></a></div>
  </>;

  const mobileNavigation = <>
    <button type="button" className={`mobile-public-nav-backdrop${isOpen ? " is-open" : ""}`} aria-label="Close navigation menu" tabIndex={isOpen ? 0 : -1} onClick={closeMenu} />
    <aside id="mobile-public-navigation" className={`mobile-public-nav${isOpen ? " is-open" : ""}`} aria-hidden={!isOpen}>
      <div className="mobile-public-nav-heading"><LearningMark /><button type="button" aria-label="Close navigation menu" onClick={closeMenu}><LearningIcon name="close" /></button></div>
      <nav aria-label="Mobile primary navigation">{navigation}</nav>
      <div className="mobile-public-nav-account"><Link className="button button-outline" href="/sign-up" onClick={closeMenu}>Sign Up</Link><Link className="button button-login" href="/sign-up" onClick={closeMenu}>Login <span aria-hidden="true">→</span></Link></div>
    </aside>
  </>;

  return <>
    <header className="public-header">
      <div className="section-shell header-inner">
        <LearningMark />
        <nav className="desktop-public-nav" aria-label="Primary navigation">{navigation}</nav>
        <div className="desktop-auth-actions"><Link className="button button-outline" href="/sign-up">Sign Up</Link><Link className="button button-login" href="/sign-up">Login <span aria-hidden="true"></span></Link></div>
        <div className="mobile-header-controls">
          <button type="button" className="mobile-menu-button" aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={isOpen} aria-controls="mobile-public-navigation" onClick={() => setIsOpen((open) => !open)}><LearningIcon name={isOpen ? "close" : "menu"} /></button>
          <button type="button" className="mobile-account-button" aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={isOpen} aria-controls="mobile-public-navigation" onClick={() => setIsOpen((open) => !open)}><AccountIcon /></button>
        </div>
      </div>
    </header>
    {clientReady ? createPortal(mobileNavigation, document.body) : null}
  </>;
}
