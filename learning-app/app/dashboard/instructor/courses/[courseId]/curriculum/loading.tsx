import { Skeleton } from "@/app/components/ui/skeleton";

export default function CurriculumLoading() {
  return <section className="curriculum-page section-shell" aria-busy="true" aria-label="Loading course curriculum">
    <div className="course-editor-heading"><div className="skeleton-field"><Skeleton className="skeleton-eyebrow" /><Skeleton className="skeleton-title" /><Skeleton className="skeleton-copy" /></div><div className="skeleton-field"><Skeleton className="skeleton-status" /><Skeleton className="skeleton-link" /></div></div>
    <div className="curriculum-loading-list" aria-hidden="true">{[1, 2].map((item) => <div key={item} className="curriculum-module skeleton-card"><Skeleton className="skeleton-row-title" /><Skeleton className="skeleton-input" /><Skeleton className="skeleton-note" /></div>)}</div>
    <span className="sr-only">Loading curriculum…</span>
  </section>;
}
