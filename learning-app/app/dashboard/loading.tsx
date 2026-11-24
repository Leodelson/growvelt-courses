import { Skeleton } from "@/app/components/ui/skeleton";
import styles from "@/app/components/learning/dashboard-home.module.css";

export default function DashboardLoading() {
  return <section className={styles.page} aria-busy="true">
    <span className="sr-only">Loading the learning home…</span>
    <header className={styles.header}><div><Skeleton className="skeleton-eyebrow" /><Skeleton className="skeleton-title skeleton-title-wide" /><Skeleton className="skeleton-copy" /></div><Skeleton className="skeleton-button" /></header>
    <div className={styles.search}><Skeleton className="skeleton-icon"/><Skeleton className="skeleton-copy"/><Skeleton className="skeleton-button" /></div>
    <section className={styles.subjects}><div><Skeleton className="skeleton-eyebrow"/><Skeleton className="skeleton-title"/></div><div className={styles.subjectGrid}>{Array.from({length:6},(_,index)=><div className={styles.subject} key={index}><Skeleton className="skeleton-title"/><Skeleton className="skeleton-copy"/></div>)}</div></section>
    <div className={styles.spotlight}><div className={styles.spotlightVisual}><Skeleton className="skeleton-copy"/></div><div className={styles.spotlightContent}><Skeleton className="skeleton-eyebrow"/><Skeleton className="skeleton-title"/><Skeleton className="skeleton-copy"/><Skeleton className="skeleton-copy skeleton-copy-short"/><Skeleton className="skeleton-button"/></div></div>
  </section>;
}
