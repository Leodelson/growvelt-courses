import { Skeleton } from "@/app/components/ui/skeleton";
import styles from "@/app/components/learning/dashboard-home.module.css";

export default function DashboardLoading() {
  return (
    <section className={styles.page} aria-busy="true">
      <span className="sr-only">Loading your dashboard…</span>
      <div className={styles.spotlight}>
        <div className={styles.spotlightContent}>
          <Skeleton className="skeleton-eyebrow" />
          <Skeleton className="skeleton-title skeleton-title-wide" />
          <Skeleton className="skeleton-copy" />
          <Skeleton className="skeleton-button" />
        </div>
        <Skeleton className={styles.spotlightVisual} />
      </div>
      <Skeleton className="skeleton-title" />
    </section>
  );
}
