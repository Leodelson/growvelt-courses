import { Skeleton } from "@/app/components/ui/skeleton";
import { ApplicationStatusHeader } from "./application-status-header";
import styles from "./application-status.module.css";

export default function TeachApplicationLoading() {
  return <><ApplicationStatusHeader /><main id="main-content" className={`section-shell ${styles.main}`} aria-busy="true"><p className="sr-only" role="status">Loading Instructor application status…</p><section className="application-status skeleton-card"><Skeleton className="skeleton-eyebrow" /><Skeleton className="skeleton-title" /><Skeleton className="skeleton-copy" /><Skeleton className="skeleton-copy skeleton-copy-short" /><Skeleton className="skeleton-button" /></section></main></>;
}
