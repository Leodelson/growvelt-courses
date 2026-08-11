import { Skeleton } from "@/app/components/ui/skeleton";

export default function PublishedCourseLoading() {
  return <section className="published-course-page section-shell" aria-busy="true"><span className="sr-only">Loading course…</span><header className="published-course-hero"><Skeleton className="skeleton-line skeleton-short" /><Skeleton className="skeleton-line skeleton-title" /><Skeleton className="skeleton-line skeleton-wide" /><Skeleton className="skeleton-line skeleton-medium" /></header><div className="published-course-layout"><Skeleton className="skeleton-card published-course-skeleton" /><Skeleton className="skeleton-card published-course-skeleton" /></div></section>;
}
