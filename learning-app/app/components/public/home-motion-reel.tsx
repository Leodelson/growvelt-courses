"use client";

import { useEffect, useRef } from "react";
import { useLanguage } from "@/app/components/language-provider";
import styles from "./home-motion-reel.module.css";

const film = "/videos/growvelt-learning-reel-v1.mp4";
const copy = {
  en: { kicker: "Growvelt", title: "Where learning", accent: "meets opportunity.", intro: "Build practical skills for the next chapter of your life.", description: "A silent montage of teaching, remote learning, career preparation and professional collaboration." },
  fr: { kicker: "Growvelt", title: "L’apprentissage ouvre", accent: "de nouvelles perspectives.", intro: "Développez des compétences pratiques pour votre prochain chapitre.", description: "Un montage muet d’enseignement, d’apprentissage à distance, de préparation professionnelle et de collaboration." },
  es: { kicker: "Growvelt", title: "Donde aprender", accent: "abre oportunidades.", intro: "Desarrolla habilidades prácticas para el próximo capítulo de tu vida.", description: "Un montaje sin sonido de enseñanza, aprendizaje remoto, preparación profesional y colaboración." },
};

export function HomeMotionReel() {
  const { locale } = useLanguage();
  const text = copy[locale];
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const frame = frameRef.current;
    if (!video || !frame) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    let visible = false;
    let disposed = false;
    const allowed = () => visible && !document.hidden && !motion.matches && !connection?.saveData;
    const sync = () => {
      if (!allowed()) { video.pause(); return; }
      if (!video.getAttribute("src")) video.src = film;
      void video.play().then(() => {
        // Late promises must not override reduced motion, hidden tabs or unmount.
        if (disposed || !allowed()) video.pause();
      }).catch(() => { /* Keep the poster if the browser blocks autoplay. */ });
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: 0.15 });
    observer.observe(frame);
    const preferenceChanged = () => sync();
    motion.addEventListener("change", preferenceChanged);
    document.addEventListener("visibilitychange", sync);
    return () => {
      disposed = true;
      observer.disconnect();
      motion.removeEventListener("change", preferenceChanged);
      document.removeEventListener("visibilitychange", sync);
      video.pause();
    };
  }, []);

  return <section className={styles.reel} ref={frameRef} aria-labelledby="home-motion-title">
    <div className={styles.frame}>
      <video id="home-motion-video" ref={videoRef} className={styles.video} muted playsInline loop disablePictureInPicture disableRemotePlayback controlsList="nodownload nofullscreen noremoteplayback" preload="none" poster="/videos/growvelt-learning-reel-v1.webp" aria-label={text.description} />
      <div className={styles.shade} aria-hidden="true" />
      <div className={styles.caption}><p className={styles.kicker}>{text.kicker}</p><h2 id="home-motion-title">{text.title}<span>{text.accent}</span></h2><p className={styles.intro}>{text.intro}</p></div>
    </div>
  </section>;
}
