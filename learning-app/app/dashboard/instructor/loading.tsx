import { Skeleton } from "@/app/components/ui/skeleton";

export default function DashboardInstructorLoading() {
  return <section className="instructor-page section-shell" aria-busy="true"><p className="sr-only" role="status">Loading Instructor workspace…</p><section className="application-status skeleton-card" aria-hidden="true"><Skeleton className="skeleton-eyebrow" /><Skeleton className="skeleton-title" /><Skeleton className="skeleton-copy" /><Skeleton className="skeleton-copy skeleton-copy-short" /><div className="skeleton-action-row"><Skeleton className="skeleton-button" /><Skeleton className="skeleton-button" /></div></section></section>;
}
