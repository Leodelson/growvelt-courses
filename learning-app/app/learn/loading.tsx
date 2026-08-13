import { PublicHeader } from "@/app/components/public-header";
import { Skeleton } from "@/app/components/ui/skeleton";

export default function PublicCatalogLoading() {
  return <div className="public-page"><PublicHeader /><main className="catalog-page section-shell" aria-busy="true"><span className="sr-only">Loading published courses…</span><header className="catalog-hero"><Skeleton className="skeleton-line skeleton-short" /><Skeleton className="skeleton-line skeleton-title" /><Skeleton className="skeleton-line skeleton-wide" /></header><div className="public-catalog-skeleton-controls"><Skeleton className="skeleton-line" /><Skeleton className="skeleton-line" /><Skeleton className="skeleton-line" /></div><div className="course-grid published-course-grid">{Array.from({ length: 6 }, (_, index) => <Skeleton className="skeleton-card catalog-course-skeleton" key={index} />)}</div></main></div>;
}
