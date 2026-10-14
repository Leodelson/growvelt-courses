import Link from "next/link";
import type { ComponentProps } from "react";
import { LearningIcon } from "@/app/components/learning-icon";
import styles from "./empty-state.module.css";

type EmptyStateAction = { href: string; label: string };

type EmptyStateProps = {
  titleId: string;
  title: string;
  description: string;
  eyebrow?: string;
  icon: ComponentProps<typeof LearningIcon>["name"];
  size?: "page" | "section";
  headingLevel?: 1 | 2 | 3;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  note?: { title: string; description: string };
};

export function EmptyState({
  titleId, title, description, eyebrow, icon, size = "section", headingLevel = 2,
  primaryAction, secondaryAction, note,
}: EmptyStateProps) {
  const Heading = `h${headingLevel}` as "h1" | "h2" | "h3";

  return <div className={styles.frame}><section className={`${styles.panel} ${size === "page" ? styles.page : styles.section}`} aria-labelledby={titleId}>
    <div className={styles.content}>
      {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
      <Heading className={styles.title} id={titleId}>{title}</Heading>
      <p className={styles.description}>{description}</p>
      {note && <div className={styles.note}>
        <span className={styles.noteIcon}><LearningIcon name={icon} size={19} /></span>
        <div><strong>{note.title}</strong><p>{note.description}</p></div>
      </div>}
      {(primaryAction || secondaryAction) && <div className={styles.actions}>
        {primaryAction && <Link prefetch={false} className={`button ${styles.primary}`} href={primaryAction.href}>{primaryAction.label}<span aria-hidden="true">↗</span></Link>}
        {secondaryAction && <Link prefetch={false} className={`button button-secondary ${styles.secondary}`} href={secondaryAction.href}>{secondaryAction.label}</Link>}
      </div>}
    </div>
    <div className={styles.visual} aria-hidden="true">
      <div className={styles.orbit} />
      <div className={styles.backCard} />
      <div className={styles.frontCard}>
        <div className={styles.symbol}><LearningIcon name={icon} size={38} /></div>
        <span className={styles.longLine} /><span className={styles.shortLine} />
        <div className={styles.cardFooter}><span /><span /><span /></div>
      </div>
      <span className={styles.spark}>+</span>
      <span className={styles.accentDot} />
    </div>
  </section></div>;
}
