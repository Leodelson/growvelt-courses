"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Layers3, Lightbulb, ShieldCheck } from "lucide-react";
import { PublicHeader } from "@/app/components/public-header";
import FooterWrapper from "@/app/components/FooterWrapper";
import { useLanguage } from "@/app/components/language-provider";
import { publicExperienceCopy } from "@/app/lib/public-experience-copy";
import styles from "./public-experience.module.css";
import { TeachOpening } from "./teach-opening";

const benefitIcons = [Lightbulb, BookOpen, Layers3];

export function PublicTeach() {
  const { locale, t } = useLanguage();
  const copy = publicExperienceCopy[locale].teach;

  return <div className={styles.publicPage}>
    <PublicHeader />
    <main id="public-main">
      <TeachOpening />
      <section id="teach-introduction" className={`${styles.wrap} ${styles.hero} ${styles.teachHero}`} aria-labelledby="teach-title">
        <div className={styles.heroCopy}><p className={styles.eyebrow}><span />{copy.eyebrow}</p><h1 id="teach-title">{copy.title}<span>{copy.accent}</span></h1><p className={styles.lede}>{copy.intro}</p><div className={styles.heroActions}><Link className={styles.primary} href="/teach/apply">{copy.action}<ArrowUpRight aria-hidden="true" size={19} /></Link></div></div>
        <figure className={styles.heroVisual}><div className={styles.heroPhoto}><Image src="/images/black-american-lady.png" alt={copy.imageAlt} fill priority sizes="(max-width: 780px) 100vw, 45vw" /></div><figcaption><span>{copy.caption}</span><strong>{t("teach.imageTitle")}</strong></figcaption></figure>
      </section>
      <section className={`${styles.wrap} ${styles.teachBenefits}`} aria-labelledby="teach-benefits-title"><h2 id="teach-benefits-title">{copy.benefitsTitle}</h2><div className={styles.benefitGrid}>{copy.benefits.map((benefit, index) => { const Icon = benefitIcons[index]; return <article key={benefit.title}><Icon aria-hidden="true" size={28} /><h3>{benefit.title}</h3><p>{benefit.copy}</p></article>; })}</div></section>
      <section className={`${styles.wrap} ${styles.teachProcess}`} aria-labelledby="teach-process-title"><div><p className={styles.eyebrow}>{copy.processEyebrow}</p><h2 id="teach-process-title">{copy.processTitle}</h2><p>{copy.processCopy}</p></div><ol>{copy.process.map((step, index) => <li key={step.title}><span>0{index + 1}</span><div><h3>{step.title}</h3><p>{step.copy}</p></div></li>)}</ol></section>
      <aside className={`${styles.wrap} ${styles.rights}`} aria-labelledby="teaching-rights-title"><ShieldCheck aria-hidden="true" size={27} /><div><p className={styles.eyebrow}>{copy.rightsEyebrow}</p><h2 id="teaching-rights-title">{t("teach.rightsTitle")}</h2><p>{t("teach.rightsCopy")}</p></div></aside>
      <section className={`${styles.wrap} ${styles.section} ${styles.faq}`} aria-labelledby="teach-faq-title"><header><h2 id="teach-faq-title">{copy.faqTitle}</h2><p>{t("teach.note")}</p><Link className={styles.quiet} href="/contact">{copy.support}<ArrowUpRight aria-hidden="true" size={17} /></Link></header><div>{copy.questions.map((question) => <details key={question.title}><summary>{question.title}<span aria-hidden="true">+</span></summary><p>{question.copy}</p></details>)}</div></section>
    </main>
    <FooterWrapper />
  </div>;
}
