import { Skeleton } from "@/app/components/ui/skeleton";
export default function CertificateLoading() { return <section className="certificate-view section-shell" aria-label="Loading certificate" role="status" aria-busy="true"><span className="sr-only">Loading certificate…</span><Skeleton className="skeleton-block" style={{ minHeight: 560 }} aria-hidden="true" /></section>; }
