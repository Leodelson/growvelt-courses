"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useLanguage } from "@/app/components/language-provider";
import styles from "./teach-opening.module.css";

const copy = {
  en: { eyebrow: "Become Instructor", title: "Talent is", line: "everywhere.", accent: "Opportunity", close: "should be, too.", intro: "Someone is ready to learn what you know. Turn your experience into practical lessons that help others move forward.", action: "Explore teaching", alt: "A smiling educator in a bright workspace" },
  fr: { eyebrow: "Devenir formateur", title: "Le talent est", line: "partout.", accent: "Les possibilités", close: "devraient l’être aussi.", intro: "Quelqu’un est prêt à apprendre ce que vous savez. Transformez votre expérience en leçons pratiques pour aider les autres à avancer.", action: "Découvrir l’enseignement", alt: "Une formatrice souriante dans un espace lumineux" },
  es: { eyebrow: "Hazte instructor", title: "El talento está", line: "en todas partes.", accent: "Las oportunidades", close: "también deberían estarlo.", intro: "Alguien está listo para aprender lo que sabes. Convierte tu experiencia en lecciones prácticas que ayuden a otros a avanzar.", action: "Descubrir la enseñanza", alt: "Una educadora sonriente en un espacio luminoso" },
};

export function TeachOpening() {
  const { locale } = useLanguage();
  const text = copy[locale];
  return <section className={styles.opening} aria-labelledby="teach-opening-title">
    <picture className={styles.photo}>
      <source media="(max-width: 780px)" srcSet="/images/teach-opening-mobile-v1.webp" type="image/webp" />
      <Image src="/images/teach-opening-educator-v1.webp" alt={text.alt} fill priority sizes="100vw" />
    </picture>
    <div className={styles.wash} aria-hidden="true" />
    <div className={styles.content}>
      <h2 id="teach-opening-title">{text.title}<span>{text.line}</span><em>{text.accent}<span>{text.close}</span></em></h2>
      <p className={styles.intro}>{text.intro}</p>
      <Link className={styles.action} href="#teach-introduction">{text.action}<ArrowUpRight size={20} aria-hidden="true" /></Link>
    </div>
  </section>;
}
