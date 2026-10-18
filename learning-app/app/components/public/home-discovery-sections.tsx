"use client";
import { careersAbsoluteUrl } from "@/app/lib/site-urls.mjs";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, BarChart3, BriefcaseBusiness, Check, Clock3, Code2, Handshake, Megaphone, Search, Sparkles } from "lucide-react";
import { useLanguage } from "@/app/components/language-provider";
import { homeDiscoveryCopy } from "@/app/lib/home-discovery-copy";
import styles from "./home-discovery.module.css";

const goalIcons = [BarChart3, Code2, Megaphone, BriefcaseBusiness];
const sessionLengths = [10, 20, 30];
const routineSegments = [[3, 5, 2], [5, 10, 5], [5, 20, 5]];

export function HomeSkillFinder() {
  const { locale } = useLanguage();
  const copy = homeDiscoveryCopy[locale].finder;
  const [selected, setSelected] = useState(0);
  const goal = copy.goals[selected];
  const Icon = goalIcons[selected];
  return <section className={`${styles.wrap} ${styles.finder}`} aria-labelledby="skill-finder-title">
    <header className={styles.heading}><p className={styles.eyebrow}>{copy.eyebrow}</p><h2 id="skill-finder-title">{copy.title}</h2><p>{copy.intro}</p></header>
    <div className={styles.finderLayout}>
      <div className={styles.goalList} role="group" aria-label={copy.label}>{copy.goals.map((item, index) => { const GoalIcon = goalIcons[index]; return <button key={item.label} type="button" aria-pressed={selected === index} aria-controls="skill-finder-results" onClick={() => setSelected(index)}><GoalIcon size={21} aria-hidden="true" /><span>{item.label}</span><ArrowUpRight size={18} aria-hidden="true" /></button>; })}</div>
      <div id="skill-finder-results" className={styles.goalResult} aria-live="polite" aria-atomic="true">
        <span className={styles.goalIcon}><Icon size={28} aria-hidden="true" /></span><h3>{goal.title}</h3><p>{goal.copy}</p>
        <p className={styles.toolLabel}>{copy.tools}</p><div className={styles.tools}>{goal.terms.map((term) => <Link key={term} href={`/learn?q=${encodeURIComponent(term)}`}><Search size={14} aria-hidden="true" />{term}<ArrowUpRight size={14} aria-hidden="true" /></Link>)}</div>
        <p className={styles.note}>{copy.note}</p>
      </div>
    </div>
  </section>;
}

export function HomeStudyRoutine() {
  const { locale } = useLanguage();
  const copy = homeDiscoveryCopy[locale].routine;
  const [selected, setSelected] = useState(1);
  return <section className={styles.routineBand} aria-labelledby="study-routine-title"><div className={`${styles.wrap} ${styles.routine}`}>
    <div className={styles.heading}><p className={styles.eyebrow}><Clock3 size={17} aria-hidden="true" />{copy.eyebrow}</p><h2 id="study-routine-title">{copy.title}</h2><p>{copy.intro}</p>
      <div className={styles.sessionPicker} role="group" aria-label={copy.label}>{sessionLengths.map((minutes, index) => <button key={minutes} type="button" aria-pressed={selected === index} aria-controls="study-routine-preview" onClick={() => setSelected(index)}>{minutes} <span>{copy.minutes}</span></button>)}</div>
      <ul className={styles.features}>{copy.features.map((feature) => <li key={feature}><Check size={16} aria-hidden="true" /><span>{feature}</span></li>)}</ul>
    </div>
    <div id="study-routine-preview" className={styles.routinePreview} aria-live="polite" aria-atomic="true"><div className={styles.routineTotal}><span>{copy.frequency}</span><strong>{sessionLengths[selected] * 3}<small>{copy.weekly}</small></strong></div><p className={styles.sessionLabel}>{copy.session}</p><ol>{copy.steps.map((step, index) => <li key={step}><span aria-hidden="true">0{index + 1}</span><p>{step}</p><strong>{routineSegments[selected][index]} <small>{copy.minutes}</small></strong></li>)}</ol><p className={styles.note}>{copy.note}</p></div>
  </div></section>;
}

export function HomeHiring() {
  const { locale } = useLanguage();
  const copy = homeDiscoveryCopy[locale].hiring;
  return <section className={`${styles.wrap} ${styles.hiring}`} aria-labelledby="home-hiring-title">
    <div className={styles.editorialPhoto}><Image src="/images/home-hiring-corporate-woman.webp" alt="" width={1200} height={800} sizes="(max-width: 760px) calc(100vw - 40px), 550px" /></div>
    <div className={styles.editorialCopy}><p className={styles.eyebrow}><BriefcaseBusiness size={17} aria-hidden="true" />{copy.eyebrow}</p><h2 id="home-hiring-title">{copy.title}</h2><p>{copy.intro}</p><a className={styles.action} href={careersAbsoluteUrl("/")} target="_blank" rel="noreferrer" aria-describedby="hiring-link-note">{copy.action}<ArrowUpRight size={18} aria-hidden="true" /></a><p id="hiring-link-note" className={styles.note}>{copy.note}</p></div>
  </section>;
}

export function HomePartnership() {
  const { locale } = useLanguage();
  const copy = homeDiscoveryCopy[locale].partner;
  return <section className={styles.partnerBand} aria-labelledby="home-partner-title"><div className={`${styles.wrap} ${styles.partner}`}>
    <div className={styles.editorialCopy}><p className={styles.eyebrow}><Handshake size={17} aria-hidden="true" />{copy.eyebrow}</p><h2 id="home-partner-title">{copy.title}</h2><p>{copy.intro}</p><ul className={styles.partnerTopics}>{copy.topics.map((topic) => <li key={topic}><Sparkles size={15} aria-hidden="true" />{topic}</li>)}</ul><Link className={styles.action} href="/partner-with-growvelt">{copy.action}<ArrowUpRight size={18} aria-hidden="true" /></Link></div>
    <div className={styles.editorialPhoto}><Image src="/images/home-partnership-collaboration.webp" alt="" width={1200} height={800} sizes="(max-width: 760px) calc(100vw - 40px), 550px" /></div>
  </div></section>;
}
