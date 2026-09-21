import { Skeleton } from "@/app/components/ui/skeleton";
import { PublicHeader } from "@/app/components/public-header";

export default function TeachApplyLoading() {
  return <div className="public-page"><PublicHeader /><main className="instructor-page section-shell" aria-busy="true"><p className="sr-only" role="status">Loading Instructor application…</p><section className="instructor-loading-intro"><Skeleton className="skeleton-eyebrow" /><Skeleton className="skeleton-title skeleton-title-wide" /><Skeleton className="skeleton-copy" /><Skeleton className="skeleton-copy skeleton-copy-short" /></section><section className="instructor-application-form skeleton-card"><Skeleton className="skeleton-note" />{Array.from({ length: 4 }, (_, index) => <div className="skeleton-field" key={index}><Skeleton className="skeleton-label" /><Skeleton className="skeleton-input" /></div>)}{Array.from({ length: 3 }, (_, index) => <div className="skeleton-field" key={`area-${index}`}><Skeleton className="skeleton-label" /><Skeleton className="skeleton-textarea" /></div>)}<Skeleton className="skeleton-note" /><Skeleton className="skeleton-button" /></section></main></div>;
}
