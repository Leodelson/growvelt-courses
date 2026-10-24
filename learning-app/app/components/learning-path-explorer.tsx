"use client";

import Link from "next/link";
import { ArrowUpRight, BarChart3, Code2, Megaphone } from "lucide-react";
import { useLanguage } from "@/app/components/language-provider";
import { publicExperienceCopy } from "@/app/lib/public-experience-copy";
import styles from "./learning-path-explorer.module.css";

const icons = [BarChart3, Code2, Megaphone];

export function LearningPathExplorer({ basePath = "/learn" }: { basePath?: string }) {
  const { locale } = useLanguage();
  const copy = publicExperienceCopy[locale].learningPaths;

  return <section className={styles.section} aria-labelledby="learning-paths-title">
    <header className={styles.heading}>
      <p className={styles.eyebrow}>{copy.eyebrow}</p>
      <h2 id="learning-paths-title">{copy.title}</h2>
      <p>{copy.intro}</p>
    </header>
    <div className={styles.grid}>
      {copy.items.map((path, index) => {
        const Icon = icons[index] ?? BarChart3;
        return <Link className={styles.card} href={`${basePath}?category=${encodeURIComponent(path.category)}`} key={path.category}>
          <span className={styles.icon}><Icon aria-hidden="true" size={23} /></span>
          <span className={styles.label}>{path.label}</span>
          <span className={styles.title}>{path.title}</span>
          <span className={styles.copy}>{path.copy}</span>
          <span className={styles.action}>{copy.action}<ArrowUpRight aria-hidden="true" size={17} /></span>
        </Link>;
      })}
    </div>
  </section>;
}
