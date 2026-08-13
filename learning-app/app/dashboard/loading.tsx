import { Skeleton } from "@/app/components/ui/skeleton";

export default function DashboardLoading() {
  return <section className="learner-overview" aria-busy="true">
    <span className="sr-only">Loading your learning overview…</span>
    <header className="learner-overview-hero"><div><Skeleton className="skeleton-line skeleton-short" /><Skeleton className="skeleton-line skeleton-title" /><Skeleton className="skeleton-line skeleton-wide" /></div></header>
    <Skeleton className="skeleton-card learner-dashboard-feature-skeleton" />
    <div className="learner-stat-grid">{Array.from({ length: 4 }, (_, index) => <Skeleton className="skeleton-card learner-stat-skeleton" key={index} />)}</div>
    <div className="learner-course-grid">{Array.from({ length: 2 }, (_, index) => <Skeleton className="skeleton-card learner-course-skeleton" key={index} />)}</div>
  </section>;
}
