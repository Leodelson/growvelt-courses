import { Skeleton } from "@/app/components/ui/skeleton";

export default function CertificatesLoading() {
  return <section className="certificate-list section-shell certificates-loading" aria-busy="true"><span className="sr-only">Loading certificates…</span><header className="certificate-list-hero"><Skeleton className="skeleton-eyebrow" /><Skeleton className="skeleton-title skeleton-title-wide" /><Skeleton className="skeleton-copy" /></header><div className="my-learning-list">{Array.from({ length: 2 }, (_, index) => <article className="my-learning-skeleton" key={index}><div><Skeleton className="skeleton-eyebrow" /><Skeleton className="skeleton-row-title" /><Skeleton className="skeleton-copy" /><Skeleton className="skeleton-date" /></div><div className="my-learning-skeleton-action"><Skeleton className="skeleton-button" /></div></article>)}</div></section>;
}
