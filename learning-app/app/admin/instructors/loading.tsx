import { Skeleton } from "@/app/components/ui/skeleton";

export default function AdminInstructorQueueLoading() {
  return <main className="admin-page section-shell" aria-busy="true"><p className="sr-only" role="status">Loading Instructor applications…</p><Skeleton className="skeleton-link" /><header className="admin-page-header"><Skeleton className="skeleton-eyebrow" /><Skeleton className="skeleton-title skeleton-title-wide" /><Skeleton className="skeleton-copy" /></header><section className="admin-application-list skeleton-list">{Array.from({ length: 3 }, (_, index) => <article className="admin-application-row" key={index}><div><Skeleton className="skeleton-eyebrow" /><Skeleton className="skeleton-row-title" /><Skeleton className="skeleton-copy skeleton-copy-short" /></div><div className="admin-row-meta"><Skeleton className="skeleton-date" /><Skeleton className="skeleton-button" /></div></article>)}</section></main>;
}
