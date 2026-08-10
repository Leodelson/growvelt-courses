import { Skeleton } from "@/app/components/ui/skeleton";

export default function DashboardInstructorCoursesLoading() {
  return <section className="course-management-page section-shell" aria-busy="true"><p className="sr-only" role="status">Loading your courses…</p><header className="course-management-heading"><div><Skeleton className="skeleton-eyebrow" /><Skeleton className="skeleton-title" /><Skeleton className="skeleton-copy" /></div><Skeleton className="skeleton-button" /></header><section className="instructor-course-list skeleton-list" aria-hidden="true">{Array.from({ length: 3 }, (_, index) => <article className="instructor-course-row" key={index}><div><Skeleton className="skeleton-status" /><Skeleton className="skeleton-row-title" /><Skeleton className="skeleton-copy" /></div><Skeleton className="skeleton-button" /></article>)}</section></section>;
}
