import { PublicHeader } from "@/app/components/public-header";
import { Skeleton } from "@/app/components/ui/skeleton";
import styles from "@/app/components/public-catalog.module.css";
import experience from "@/app/components/public/public-experience.module.css";

export default function PublicCatalogLoading() {
  return <div className={experience.publicPage}><PublicHeader /><main id="public-main" className={styles.page} aria-busy="true"><span className="sr-only">Loading published courses…</span><header className={styles.hero}><Skeleton className="skeleton-eyebrow" /><Skeleton className="skeleton-title skeleton-title-wide" /><Skeleton className="skeleton-copy" /><Skeleton className="skeleton-copy skeleton-copy-short" /></header><div className={styles.controls}>{Array.from({ length: 4 }, (_, index) => <Skeleton className="skeleton-input" key={index} />)}</div><div className={styles.grid}>{Array.from({ length: 6 }, (_, index) => <article className="catalog-course-skeleton" key={index}><Skeleton className="skeleton-course-art" /><div><Skeleton className="skeleton-status" /><Skeleton className="skeleton-row-title" /><Skeleton className="skeleton-copy" /><Skeleton className="skeleton-copy skeleton-copy-short" /><Skeleton className="skeleton-button" /></div></article>)}</div></main></div>;
}
