"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LearningIcon } from "@/app/components/learning-icon";
import { LearningMark } from "@/app/components/learning-mark";

export function PublicHeader() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const closeMenu = () => setIsOpen(false);

  return <header className="public-header">
    <div className="section-shell header-inner">
      <LearningMark />
      <nav className="desktop-public-nav" aria-label="Primary navigation">
        <Link href="/learn">Explore</Link>
        <Link href="/#paths">Learning Paths</Link>
        <Link href="/certificates">Certificates</Link>
        <Link href="/teach">Teach on Growvelt</Link>
      </nav>
      <div className="header-actions">
        <Link className="text-link sign-in-link" href="/dashboard">Sign in</Link>
        <Link className="button button-small" href="/dashboard">My Learning</Link>
        <button type="button" className="mobile-menu-button" aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={isOpen} aria-controls="mobile-public-navigation" onClick={() => setIsOpen((open) => !open)}>
          <LearningIcon name={isOpen ? "close" : "menu"} />
        </button>
      </div>
    </div>
    <div id="mobile-public-navigation" className={`mobile-public-nav ${isOpen ? "is-open" : ""}`} hidden={!isOpen}>
      <nav aria-label="Mobile primary navigation">
        <Link href="/learn" onClick={closeMenu}>Explore</Link>
        <Link href="/#paths" onClick={closeMenu}>Learning Paths</Link>
        <Link href="/certificates" onClick={closeMenu}>Certificates</Link>
        <Link href="/teach" onClick={closeMenu}>Teach on Growvelt</Link>
      </nav>
      <div>
        <Link className="text-link" href="/dashboard" onClick={closeMenu}>Sign in</Link>
        <Link className="button button-primary" href="/dashboard" onClick={closeMenu}>Get started</Link>
      </div>
    </div>
  </header>;
}
