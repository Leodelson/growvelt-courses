"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useLanguage } from "@/app/components/language-provider";
import styles from "./home-motion-reel.module.css";

const film = "/videos/growvelt-learning-reel-v1.mp4";
const copy = {
  en: { kicker: "A world of possibility", title: "Learn. Share. Build what’s next.", note: "Illustrative AI-generated scenes", description: "A silent montage of teaching, remote learning, career preparation and professional collaboration.", play: "Play video", pause: "Pause video", unavailable: "Video unavailable. You can continue exploring below." },
  fr: { kicker: "Un monde de possibilités", title: "Apprendre. Partager. Construire l’avenir.", note: "Scènes illustratives générées par IA", description: "Un montage muet d’enseignement, d’apprentissage à distance, de préparation professionnelle et de collaboration.", play: "Lire la vidéo", pause: "Mettre en pause", unavailable: "Vidéo indisponible. Poursuivez votre découverte ci-dessous." },
  es: { kicker: "Un mundo de posibilidades", title: "Aprende. Comparte. Construye el futuro.", note: "Escenas ilustrativas generadas con IA", description: "Un montaje sin sonido de enseñanza, aprendizaje remoto, preparación profesional y colaboración.", play: "Reproducir vídeo", pause: "Pausar vídeo", unavailable: "Vídeo no disponible. Puedes seguir explorando abajo." },
};

export function HomeMotionReel() {
  const { locale } = useLanguage();
  const text = copy[locale];
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLElement>(null);
  const playback = useRef<{ toggle: () => void }>({ toggle: () => undefined });
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const frame = frameRef.current;
    if (!video || !frame) return;
    const controls = playback.current;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    let visible = false;
    let intent: "auto" | "play" | "pause" = "auto";
    let disposed = false;
    const allowed = () => visible && !document.hidden && intent !== "pause" && (intent === "play" || (!motion.matches && !connection?.saveData));
    const sync = () => {
      if (!allowed()) { video.pause(); return; }
      if (!video.getAttribute("src")) video.src = film;
      void video.play().then(() => {
        // Late promises must not override pause, hidden tabs or unmount.
        if (disposed || !allowed()) video.pause();
      }).catch(() => { /* Browser autoplay policies leave the play control available. */ });
    };
    controls.toggle = () => { intent = video.paused ? "play" : "pause"; sync(); };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: 0.15 });
    observer.observe(frame);
    const preferenceChanged = () => { if (intent !== "pause") intent = "auto"; sync(); };
    motion.addEventListener("change", preferenceChanged);
    document.addEventListener("visibilitychange", sync);
    return () => {
      disposed = true;
      observer.disconnect();
      motion.removeEventListener("change", preferenceChanged);
      document.removeEventListener("visibilitychange", sync);
      controls.toggle = () => undefined;
      video.pause();
    };
  }, []);

  return <section className={styles.reel} ref={frameRef} aria-labelledby="home-motion-title">
    <div className={styles.frame}>
      <video id="home-motion-video" ref={videoRef} className={styles.video} muted playsInline loop preload="none" poster="/videos/growvelt-learning-reel-v1.webp" aria-label={text.description} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => { setFailed(true); setPlaying(false); }} />
      <div className={styles.shade} aria-hidden="true" />
      <div className={styles.caption}><p>{text.kicker}</p><h2 id="home-motion-title">{text.title}</h2></div>
      {!failed && <button className={styles.control} type="button" onClick={() => playback.current.toggle()} aria-label={playing ? text.pause : text.play} aria-controls="home-motion-video"><span aria-hidden="true">{playing ? <Pause size={17} /> : <Play size={17} />}</span>{playing ? text.pause : text.play}</button>}
    </div>
    <div className={styles.footnote}><span>{text.note}</span>{failed && <span role="status">{text.unavailable}</span>}</div>
  </section>;
}
