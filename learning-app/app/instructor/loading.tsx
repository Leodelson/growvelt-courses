import { Skeleton } from "@/app/components/ui/skeleton";

export default function InstructorLoading() {
  return <main className="instructor-page section-shell" aria-busy="true"><p className="sr-only" role="status">Loading Instructor workspace…</p><header className="workspace-header"><Skeleton className="skeleton-eyebrow" /><Skeleton className="skeleton-link" /></header><section className="application-status skeleton-card"><Skeleton className="skeleton-title" /><Skeleton className="skeleton-copy" /><Skeleton className="skeleton-copy skeleton-copy-short" /></section></main>;
}
