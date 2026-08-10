import { Skeleton } from "@/app/components/ui/skeleton";

export default function InstructorLoading() {
  return <><header className="protected-page-header skeleton-protected-header" aria-hidden="true"><div className="protected-page-header-inner"><Skeleton className="skeleton-brand" /><Skeleton className="skeleton-link" /></div></header><main className="instructor-page section-shell" aria-busy="true"><p className="sr-only" role="status">Loading Instructor workspace…</p><section className="application-status skeleton-card"><Skeleton className="skeleton-eyebrow" /><Skeleton className="skeleton-title" /><Skeleton className="skeleton-copy" /><Skeleton className="skeleton-copy skeleton-copy-short" /></section></main></>;
}
