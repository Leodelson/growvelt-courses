import { Skeleton } from "@/app/components/ui/skeleton";

export default function SettingsLoading() {
  return <section className="settings-loading" aria-busy="true"><span className="sr-only">Loading settings…</span><header className="settings-loading-hero"><Skeleton className="skeleton-eyebrow" /><Skeleton className="skeleton-title skeleton-title-wide" /><Skeleton className="skeleton-copy" /></header><div className="settings-stack">{Array.from({ length: 4 }, (_, index) => <section className="settings-skeleton-card" key={index}><div><Skeleton className="skeleton-eyebrow" /><Skeleton className="skeleton-row-title" /><Skeleton className="skeleton-copy" /></div><Skeleton className="skeleton-button" /></section>)}</div></section>;
}
