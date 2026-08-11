import { Skeleton } from "@/app/components/ui/skeleton";

export default function AdminCourseDetailLoading() {
  return <section className="admin-page section-shell" aria-busy="true"><p className="sr-only" role="status">Loading submitted course…</p><header className="admin-page-header"><Skeleton className="skeleton-eyebrow" /><Skeleton className="skeleton-title skeleton-title-wide" /><Skeleton className="skeleton-copy" /></header><div className="admin-detail-grid" aria-hidden="true"><article className="admin-application-detail skeleton-card"><Skeleton className="skeleton-row-title" /><Skeleton className="skeleton-copy" /><Skeleton className="skeleton-note" /><Skeleton className="skeleton-note" /></article><article className="admin-review-panel skeleton-card"><Skeleton className="skeleton-row-title" /><Skeleton className="skeleton-textarea" /><Skeleton className="skeleton-button" /></article></div></section>;
}
