import { Skeleton } from "@/app/components/ui/skeleton";

export default function ProfileLoading() {
  return <section className="profile-page section-shell profile-loading" aria-busy="true"><span className="sr-only">Loading your profile…</span><Skeleton className="profile-cover-skeleton" /><section className="profile-identity-skeleton"><Skeleton className="profile-avatar-skeleton" /><div><Skeleton className="skeleton-eyebrow" /><Skeleton className="skeleton-row-title" /><Skeleton className="skeleton-copy" /></div></section><section className="profile-setup-skeleton"><Skeleton className="skeleton-eyebrow" /><Skeleton className="skeleton-row-title" /><Skeleton className="skeleton-copy" /></section></section>;
}
