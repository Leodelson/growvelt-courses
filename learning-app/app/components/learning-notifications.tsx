"use client";

import Link from "@/app/components/learning-link";
import { LearningIcon } from "@/app/components/learning-icon";

export type Notice = { id: string; kind: string; title: string; body: string; href: string | null; created_at: string; read_at: string | null };

export function LearningNotifications({ items, state, onClose, onMarkRead }: { items: Notice[]; state: "loading" | "ready" | "error"; onClose: () => void; onMarkRead: (id: string) => void }) {
  async function markRead(id: string) {
    const response = await fetch("/api/learning/notifications", { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (response.ok) onMarkRead(id);
  }
  return <section className="dashboard-notifications-popover" aria-label="Learning notifications">
    <header><div><p>Notifications</p><span>Learning updates</span></div><button type="button" aria-label="Close notifications" onClick={onClose}><LearningIcon name="close" size={18} /></button></header>
    {state === "loading" && <div className="dashboard-notifications-empty"><p>Loading notifications…</p></div>}
    {state === "error" && <div className="dashboard-notifications-empty"><p>Notifications are unavailable right now. Try again later.</p></div>}
    {state === "ready" && !items.length && <div className="dashboard-notifications-empty"><span className="dashboard-notifications-empty-icon"><LearningIcon name="bell" size={28} /></span><h2>You&rsquo;re all caught up.</h2><p>Account and learning updates will appear here.</p></div>}
    {state === "ready" && items.length > 0 && <ul className="learning-notification-list">{items.map((item) => <li className={item.read_at ? "" : "is-unread"} key={item.id}><strong>{item.title}</strong><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString()}</small><div>{item.href?.startsWith("/dashboard/") ? <Link href={item.href} onClick={onClose}>View details</Link> : null}{!item.read_at && <button type="button" onClick={() => void markRead(item.id)}>Mark as read</button>}</div></li>)}</ul>}
  </section>;
}
