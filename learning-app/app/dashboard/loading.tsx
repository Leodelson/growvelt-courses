import { Skeleton } from "@/app/components/ui/skeleton";

export default function DashboardLoading() {
  return <section className="learner-overview" aria-busy="true">
    <span className="sr-only">Loading your learning overview…</span>
    <header className="learner-overview-hero learner-overview-loading-hero"><div><Skeleton className="skeleton-eyebrow" /><Skeleton className="skeleton-title skeleton-title-wide" /><Skeleton className="skeleton-copy" /><Skeleton className="skeleton-copy skeleton-copy-short" /></div><div className="skeleton-action-row"><Skeleton className="skeleton-button" /><Skeleton className="skeleton-button" /></div></header>
    <section className="learner-dashboard-feature-skeleton"><div><Skeleton className="skeleton-status" /><Skeleton className="skeleton-eyebrow" /><Skeleton className="skeleton-title" /><Skeleton className="skeleton-copy" /><Skeleton className="skeleton-copy skeleton-copy-short" /></div><div className="learner-dashboard-progress-skeleton"><Skeleton className="skeleton-title" /><Skeleton className="skeleton-label" /><Skeleton className="skeleton-copy" /><Skeleton className="skeleton-button" /></div></section>
    <div className="learner-stat-grid">{Array.from({ length: 4 }, (_, index) => <article className="learner-stat-skeleton" key={index}><Skeleton className="skeleton-icon" /><Skeleton className="skeleton-stat" /><Skeleton className="skeleton-label" /></article>)}</div>
    <div className="learner-course-grid">{Array.from({ length: 2 }, (_, index) => <article className="learner-course-skeleton" key={index}><Skeleton className="skeleton-status" /><Skeleton className="skeleton-eyebrow" /><Skeleton className="skeleton-row-title" /><Skeleton className="skeleton-copy" /><Skeleton className="skeleton-copy skeleton-copy-short" /><Skeleton className="skeleton-copy" /><Skeleton className="skeleton-button" /></article>)}</div>
  </section>;
}
