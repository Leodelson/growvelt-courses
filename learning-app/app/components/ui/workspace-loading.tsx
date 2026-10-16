import { Skeleton } from "./skeleton";
import styles from "./workspace-loading.module.css";
export function WorkspaceLoading({label}:{label:string}) {
  return <section className={styles.page} role="status" aria-busy="true"><h1 className="sr-only">{label}</h1><header className={styles.hero}><Skeleton className="skeleton-eyebrow"/><Skeleton className="skeleton-title"/><Skeleton className="skeleton-copy"/></header><div className={styles.stats}>{Array.from({length:3},(_,index)=><div className={styles.card} key={index}><Skeleton className="skeleton-label"/><Skeleton className="skeleton-stat"/><Skeleton className="skeleton-copy"/></div>)}</div><div className={styles.panel}><Skeleton className="skeleton-title"/>{Array.from({length:3},(_,index)=><div className={styles.row} key={index}><Skeleton className="skeleton-label"/><Skeleton className="skeleton-copy"/></div>)}</div></section>;
}
