import Link from "next/link";

export function EmptyState({ title, description, actionLabel, actionHref }: { title: string; description: string; actionLabel: string; actionHref: string }) {
  return <article className="empty-state"><span aria-hidden="true">✦</span><h2>{title}</h2><p>{description}</p><Link className="text-link" href={actionHref}>{actionLabel} <span aria-hidden="true">→</span></Link></article>;
}
