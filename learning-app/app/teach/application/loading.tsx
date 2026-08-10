import { Skeleton } from "@/app/components/ui/skeleton";

export default function TeachApplicationLoading() {
  return <main className="instructor-page section-shell" aria-busy="true"><p className="sr-only" role="status">Loading Instructor application status…</p><section className="instructor-loading-intro"><Skeleton className="skeleton-link" /></section><section className="application-status skeleton-card"><Skeleton className="skeleton-eyebrow" /><Skeleton className="skeleton-title" /><Skeleton className="skeleton-copy" /><Skeleton className="skeleton-copy skeleton-copy-short" /><Skeleton className="skeleton-button" /></section></main>;
}
