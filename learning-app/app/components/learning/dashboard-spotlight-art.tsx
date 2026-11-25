"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Locale } from "@/app/lib/i18n";
import { dashboardHomeCopy } from "./dashboard-home-copy";
import styles from "./dashboard-home.module.css";

const slides = ["/images/learning-editorial-data.webp", "/images/learning-editorial-office-1.webp", "/images/learning-editorial-office-2.webp", "/images/learning-editorial-office-3.webp"];
const motionQuery = "(prefers-reduced-motion: reduce)";

function subscribeToMotion(onChange: () => void) {
  const preference = window.matchMedia(motionQuery);
  preference.addEventListener("change", onChange);
  return () => preference.removeEventListener("change", onChange);
}

function prefersReducedMotion() {
  return window.matchMedia(motionQuery).matches;
}

export function DashboardSpotlightArt({ locale }: { locale: Locale }) {
  const copy = dashboardHomeCopy[locale];
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(false);
  const [userPlaying, setUserPlaying] = useState<boolean | null>(null);
  const reducedMotion = useSyncExternalStore(subscribeToMotion, prefersReducedMotion, () => true);
  const running = userPlaying ?? !reducedMotion;

  useEffect(() => {
    if (!ready || !running) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setActive((index) => (index + 1) % slides.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [ready, running]);

  return (
    <div className={styles.spotlightVisual} role="group" aria-label={copy.artwork}>
      {slides.map((src, index) => (index === 0 || ready) && (
        <Image key={src} src={src} alt="" fill unoptimized loading={index === 0 ? "eager" : "lazy"}
          sizes="(max-width: 700px) 100vw, 45vw" onLoad={index === 0 ? () => setReady(true) : undefined}
          onError={index === 0 ? () => setReady(true) : undefined}
          className={index === active ? styles.activeImage : undefined} />
      ))}
      <div className={styles.artControls}>
        <button type="button" onClick={() => setUserPlaying(!running)} aria-label={running ? copy.pause : copy.play}>
          <span aria-hidden="true">{running ? "Ⅱ" : "▶"}</span>
        </button>
        {slides.map((src, index) => (
          <button key={src} type="button" aria-label={`${copy.image} ${index + 1}`} aria-pressed={index === active}
            onClick={() => { setReady(true); setActive(index); setUserPlaying(false); }}>
            <span className={styles.dot} aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}
