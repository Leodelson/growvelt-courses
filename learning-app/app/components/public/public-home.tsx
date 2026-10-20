"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, BarChart3, BookOpen, BriefcaseBusiness, CircleCheck, Clock3, Code2, Megaphone, Palette, Play, ShieldCheck } from "lucide-react";
import { PublicHeader } from "@/app/components/public-header";
import FooterWrapper from "@/app/components/FooterWrapper";
import { PublishedCourseCard } from "@/app/components/published-course-card";
import { useLanguage } from "@/app/components/language-provider";
import { publicExperienceCopy } from "@/app/lib/public-experience-copy";
import { growveltOrganizationJsonLd } from "@/app/lib/seo";
import type { PublishedCourse } from "@/app/lib/catalog/published-courses";
import { HomeHiring, HomePartnership, HomeSkillFinder, HomeStudyRoutine } from "./home-discovery-sections";
import styles from "./public-experience.module.css";
import { HomeMotionReel } from "./home-motion-reel";
import { LearningGoogleOneTap } from "@/app/components/auth/learning-google-one-tap";

const subjectIcons = [BarChart3, Code2, Megaphone, BriefcaseBusiness, Palette, Clock3];
const videoIds = ["b_hmIZRnD1Q", "cFJt2gytwjY", "Xac1qNAcKHc"];

export function PublicHome({ courses }: { courses: PublishedCourse[] }) {
  const { locale, t } = useLanguage();
  const copy = publicExperienceCopy[locale];
  const home = copy.home;
  const questions = [
    { title: t("home.faqOneQuestion"), copy: t("home.faqOneAnswer") },
    { title: t("home.faqTwoQuestion"), copy: t("home.faqTwoAnswer") },
    { title: t("home.faqThreeQuestion"), copy: t("home.faqThreeAnswer") },
    { title: t("home.faqFourQuestion"), copy: t("home.faqFourAnswer") },
    { title: t("home.faqFiveQuestion"), copy: t("home.faqFiveAnswer") },
  ];

  return <div className={styles.publicPage}>
    <PublicHeader />
    <LearningGoogleOneTap />
    <main id="public-main">
      <HomeMotionReel />

      <section className={`${styles.wrap} ${styles.hero}`} aria-labelledby="home-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span />{home.eyebrow}</p>
          <h1 id="home-title">{home.title}<span>{home.accent}</span></h1>
          <p className={styles.lede}>{home.intro}</p>
          <div className={styles.heroActions}><Link className={styles.primary} href="#subjects">{home.action}<ArrowUpRight aria-hidden="true" size={19} /></Link><Link className={styles.quiet} href="#how-it-works">{home.how}<ArrowDown aria-hidden="true" size={16} /></Link></div>
          <ul className={styles.promises}>{home.promises.map((promise) => <li key={promise}><CircleCheck aria-hidden="true" size={16} />{promise}</li>)}</ul>
        </div>
        <figure className={styles.heroVisual}>
          <div className={styles.heroPhoto}><Image src="/images/learning-woman-with-laptop.jpg" alt={home.imageAlt} fill priority sizes="(max-width: 780px) 100vw, 45vw" /></div>
          <div className={styles.photoAccent} aria-hidden="true" />
          <figcaption><span>{home.imageKicker}</span><strong>{home.imageTitle}</strong></figcaption>
          <div className={styles.heroStamp} aria-hidden="true"><BookOpen size={26} /><span>Growvelt<br />Learning</span></div>
        </figure>
      </section>

      <section id="subjects" className={`${styles.wrap} ${styles.section}`} aria-labelledby="subjects-title">
        <header className={styles.sectionHeading}><div><p className={styles.eyebrow}>{home.subjectsEyebrow}</p><h2 id="subjects-title">{home.subjectsTitle}</h2><p>{home.subjectsCopy}</p></div><Link className={styles.quiet} href="/learn">{home.allCourses}<ArrowUpRight aria-hidden="true" size={18} /></Link></header>
        <div className={styles.subjectGrid}>{copy.subjects.map((subject, index) => { const Icon = subjectIcons[index]; return <Link className={styles.subject} href={`/learn?category=${encodeURIComponent(subject.category)}`} key={subject.category}><span className={styles.subjectIcon}><Icon aria-hidden="true" size={24} /></span><div><h3>{subject.title}</h3><p>{subject.copy}</p></div><ArrowUpRight aria-hidden="true" size={19} /></Link>; })}</div>
      </section>

      {courses.length > 0 && <section className={`${styles.wrap} ${styles.section} ${styles.courseShelf}`} aria-labelledby="home-courses-title">
        <header className={styles.sectionHeading}><div><p className={styles.eyebrow}>{home.latestEyebrow}</p><h2 id="home-courses-title">{home.latestTitle}</h2><p>{home.latestCopy}</p></div></header>
        <div className="course-grid public-published-course-grid">{courses.map((course, index) => <PublishedCourseCard course={course} index={index} key={course.id} />)}</div>
      </section>}

      <HomeSkillFinder />

      <section id="how-it-works" className={`${styles.wrap} ${styles.journey}`} aria-labelledby="journey-title">
        <div><p className={styles.eyebrow}><ShieldCheck aria-hidden="true" size={17} />{home.journeyEyebrow}</p><h2 id="journey-title">{home.journeyTitle}</h2><p>{home.journeyCopy}</p></div>
        <ol>{home.journey.map((step, index) => <li key={step.title}><span>0{index + 1}</span><div><h3>{step.title}</h3><p>{step.copy}</p></div></li>)}</ol>
      </section>

      <HomeStudyRoutine />

      <section className={`${styles.wrap} ${styles.section}`} aria-labelledby="paths-title">
        <header className={styles.sectionHeading}><div><p className={styles.eyebrow}>{home.pathsEyebrow}</p><h2 id="paths-title">{home.pathsTitle}</h2></div></header>
        <div className={styles.pathGrid}>
          <article className={styles.path}><div className={styles.pathPhoto}><Image src="/images/teaching-practical-expertise.jpg" alt="" fill sizes="(max-width: 700px) 100vw, 45vw" /></div><div className={styles.pathCopy}><p className={styles.eyebrow}>{copy.nav.teach}</p><h3>{home.teacherTitle}</h3><p>{home.teacherCopy}</p><Link className={styles.quiet} href="/teach">{home.teacherAction}<ArrowUpRight aria-hidden="true" size={18} /></Link></div></article>
          <article className={styles.path}><div className={styles.pathPhoto}><Image src="/images/pexels-alexander-suhorucov-6457554.jpg" alt="" fill sizes="(max-width: 700px) 100vw, 45vw" /></div><div className={styles.pathCopy}><p className={styles.eyebrow}>{copy.nav.teams}</p><h3>{home.teamsTitle}</h3><p>{home.teamsCopy}</p><Link className={styles.quiet} href="/company-learning">{home.teamsAction}<ArrowUpRight aria-hidden="true" size={18} /></Link></div></article>
        </div>
      </section>

      <HomeHiring />
      <HomePartnership />

      <section className={`${styles.wrap} ${styles.guides}`} aria-labelledby="guides-title"><details><summary id="guides-title"><Play aria-hidden="true" size={20} />{home.guidesTitle}<span aria-hidden="true">+</span></summary><div className={styles.guideGrid}>{home.guides.map((title, index) => <a href={`https://www.youtube.com/watch?v=${videoIds[index]}`} key={title} target="_blank" rel="noreferrer"><Play aria-hidden="true" size={18} /><span>{title}</span><ArrowUpRight aria-hidden="true" size={16} /><span className="sr-only"> on YouTube in a new tab</span></a>)}</div></details></section>

      <section className={`${styles.wrap} ${styles.section} ${styles.faq}`} aria-labelledby="home-faq-title"><header><p className={styles.eyebrow}>{home.faqEyebrow}</p><h2 id="home-faq-title">{home.faqTitle}</h2><Link className={styles.quiet} href="/frequently-asked-questions">{home.faqLink}<ArrowUpRight aria-hidden="true" size={17} /></Link></header><div>{questions.map((question) => <details key={question.title}><summary>{question.title}<span aria-hidden="true">+</span></summary><p>{question.copy}</p></details>)}</div></section>
    </main>
    <FooterWrapper />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(growveltOrganizationJsonLd) }} />
  </div>;
}
