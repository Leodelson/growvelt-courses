"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "@/app/components/language-provider";

const slides = [
  { key: "learn", image: "/images/black beautiful.png", href: "#how-it-works" },
  { key: "teach", image: "/images/black-handsome-man.png", href: "/teach" },
  { key: "partner", image: "/images/partner-people.png", href: "/partner-with-growvelt" },
] as const;

export function HomeHeroCarousel() {
  const { t } = useLanguage();
  const [active, setActive] = useState(0);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % slides.length), 9000);
    return () => window.clearInterval(timer);
  }, []);
  const slide = slides[active];
  const copy = slide.key === "learn"
    ? { eyebrow: "Growvelt Learning", title: t("home.hero"), body: t("home.heroCopy"), action: t("home.how") }
    : slide.key === "teach"
      ? { eyebrow: t("home.teachEyebrow"), title: t("home.teachTitle"), body: t("home.teachCopy"), action: t("public.teach") }
      : { eyebrow: t("home.collabEyebrow"), title: t("home.collabTitle"), body: t("home.collabCopy"), action: t("home.partner") };

  return <section className="growvelt-hero" aria-labelledby="hero-title">
    <div className="growvelt-hero-copy" key={slide.key}>
      <p className="eyebrow">{copy.eyebrow}</p><h1 id="hero-title">{copy.title}</h1><p className="hero-lede">{copy.body}</p>
      <Link className="button button-primary" href={slide.href}>{copy.action} <span aria-hidden="true">→</span></Link>
      <div className="growvelt-hero-pagination" role="tablist" aria-label="Growvelt pathways">
        {slides.map((item, index) => <button key={item.key} type="button" role="tab" aria-selected={active === index} aria-label={`Show ${item.key} pathway`} onClick={() => setActive(index)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.key}</strong></button>)}
      </div>
    </div>
    <div className="growvelt-hero-visual" aria-hidden="true">
      {slides.map((item, index) => <Image className={index === active ? "is-active" : ""} key={item.key} src={item.image} alt="" fill priority={index === 0} sizes="(max-width: 900px) 100vw, 48vw" />)}
      <div className="growvelt-hero-orbit orbit-one" /><div className="growvelt-hero-orbit orbit-two" />
    </div>
  </section>;
}
