import { Skeleton } from "@/app/components/ui/skeleton";
import styles from "@/app/components/learning/dashboard-overview.module.css";

export default function DashboardLoading() {
  return <section className={styles.page} aria-busy="true">
    <span className="sr-only">Loading your learning overview…</span>
    <header className={styles.header}><div><Skeleton className="skeleton-eyebrow" /><Skeleton className="skeleton-title skeleton-title-wide" /><Skeleton className="skeleton-copy" /></div></header>
    <div className={styles.stats}>{Array.from({length:4},(_,index)=><div className={styles.stat} key={index}><Skeleton className="skeleton-icon"/><div><Skeleton className="skeleton-stat"/><Skeleton className="skeleton-label"/></div></div>)}</div>
    <div className={styles.focusGrid}><div className={styles.feature}><Skeleton className="skeleton-status"/><Skeleton className="skeleton-title"/><Skeleton className="skeleton-copy"/><Skeleton className="skeleton-copy skeleton-copy-short"/><Skeleton className="skeleton-button"/></div><div className={styles.snapshot}><Skeleton className="skeleton-icon"/><Skeleton className="skeleton-stat"/><Skeleton className="skeleton-copy"/></div></div>
    <div className={styles.lowerGrid}>{Array.from({length:2},(_,index)=><div className={styles.panel} key={index}><Skeleton className="skeleton-title"/><Skeleton className="skeleton-copy"/><Skeleton className="skeleton-copy skeleton-copy-short"/></div>)}</div>
  </section>;
}
