import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./workspace.module.css";

export function WorkspaceHeader({ eyebrow, title, description, href, action }: { eyebrow: string; title: string; description: string; href: string; action: string }) {
  return <header className={styles.header}><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div><Link className="button button-primary" href={href}>{action}<span aria-hidden="true"> ↗</span></Link></header>;
}

export function WorkspaceStat({ icon, value, label }: { icon: ReactNode; value: number | string; label: string }) {
  return <div className={styles.stat}>{icon}<div><strong>{value}</strong><span>{label}</span></div></div>;
}
