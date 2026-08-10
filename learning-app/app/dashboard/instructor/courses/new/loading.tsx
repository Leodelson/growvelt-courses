import { Skeleton } from "@/app/components/ui/skeleton";

export default function DashboardNewInstructorCourseLoading() {
  return <section className="course-editor-page section-shell" aria-busy="true"><p className="sr-only" role="status">Preparing course draft editor…</p><Skeleton className="skeleton-eyebrow" /><Skeleton className="skeleton-title skeleton-title-wide" /><section className="course-draft-form skeleton-card" aria-hidden="true"><Skeleton className="skeleton-input" /><Skeleton className="skeleton-textarea" /><Skeleton className="skeleton-textarea" /><Skeleton className="skeleton-input" /><Skeleton className="skeleton-button" /></section></section>;
}
