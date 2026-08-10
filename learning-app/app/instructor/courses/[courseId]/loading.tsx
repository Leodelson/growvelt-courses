import { Skeleton } from "@/app/components/ui/skeleton";

export default function InstructorCourseEditorLoading() {
  return <><header className="protected-page-header skeleton-protected-header" aria-hidden="true"><div className="protected-page-header-inner"><Skeleton className="skeleton-brand" /><Skeleton className="skeleton-link" /></div></header><main className="course-editor-page section-shell" aria-busy="true"><p className="sr-only" role="status">Loading course editor…</p><Skeleton className="skeleton-eyebrow" /><Skeleton className="skeleton-title skeleton-title-wide" /><section className="course-draft-form skeleton-card" aria-hidden="true"><Skeleton className="skeleton-input" /><Skeleton className="skeleton-textarea" /><Skeleton className="skeleton-textarea" /><Skeleton className="skeleton-input" /><Skeleton className="skeleton-button" /></section></main></>;
}
