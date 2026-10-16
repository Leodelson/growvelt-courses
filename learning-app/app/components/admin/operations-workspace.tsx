import Link from "next/link";
import type { ReactNode } from "react";
import { ReviewCollection } from "./review-collection";
import type { ReviewItem } from "@/app/lib/admin/review-presentation";
import styles from "./operations.module.css";

export function OperationsNavigation({ sections }: { sections: { id: string; label: string }[] }) {
  return <><Link className={styles.back} href="/dashboard/admin">← Back to admin workspaces</Link><nav className={styles.navigation} aria-label="Workspace sections">{sections.map(section => <a href={`#${section.id}`} key={section.id}>{section.label}</a>)}</nav></>;
}

export function OperationsSummary({ items, note }: { items: { label: string; value: number | string; detail: string }[]; note: string }) {
  return <div className={styles.summaryGroup}><section className={styles.summary} aria-label="Loaded records summary">{items.map(item => <article key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.detail}</small></article>)}</section><p className={styles.scope}>{note}</p></div>;
}

export function OperationRecords({ items, searchLabel }: { items: (ReviewItem & { content: ReactNode })[]; searchLabel: string }) {
  const groups = Object.fromEntries([...new Set(items.map(item => item.group).filter((group): group is string => Boolean(group)))].map(group => [group, group.replaceAll("_", " ")]));
  return <ReviewCollection items={items} searchLabel={searchLabel} groupLabel="Record status" allGroupsLabel="All statuses" groups={Object.keys(groups).length ? groups : undefined} />;
}
