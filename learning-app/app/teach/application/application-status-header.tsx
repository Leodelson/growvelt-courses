import Link from "@/app/components/learning-link";
import { LearningMark } from "@/app/components/learning-mark";
import { SkipLink } from "@/app/components/ui/skip-link";
import styles from "./application-status.module.css";

export function ApplicationStatusHeader() {
  return <header className={styles.header}>
    <SkipLink />
    <div className={styles.headerInner}>
      <LearningMark compact href="/dashboard" />
      <Link className={styles.teachLink} href="/teach" aria-label="Back to Become Instructor">Become Instructor</Link>
    </div>
  </header>;
}
