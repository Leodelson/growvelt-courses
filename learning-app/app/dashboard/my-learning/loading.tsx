import { Skeleton } from "@/app/components/ui/skeleton";

export default function MyLearningLoading() {
  return <section className="my-learning-page section-shell" aria-busy="true"><span className="sr-only">Loading your enrolled courses…</span><header className="catalog-hero"><Skeleton className="skeleton-line skeleton-short" /><Skeleton className="skeleton-line skeleton-title" /><Skeleton className="skeleton-line skeleton-wide" /></header><div className="my-learning-list">{Array.from({ length: 3 }, (_, index) => <Skeleton className="skeleton-card my-learning-skeleton" key={index} />)}</div></section>;
}
