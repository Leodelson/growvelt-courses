"use client";

import { useEffect, useState } from "react";
import Link from "@/app/components/learning-link";
import { LearningIcon } from "@/app/components/learning-icon";

type Notice = { id: string; kind: string; title: string; body: string; href: string | null; created_at: string; read_at: string | null };

export function LearningNotifications({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<Notice[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/learning/notifications", { credentials: "same-origin", cache: "no-store", signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error();
      return response.json() as Promise<{ notifications: Notice[] }>;
    }).then((result) => { setItems(result.notifications); setState("ready"); }).catch(() => { if (!controller.signal.aborted) setState("error"); });
    return () => controller.abort();
  }, []);
  async function markRead(id: string) {
    const response = await fetch("/api/learning/notifications", { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (response.ok) setItems((current) => current.map((item) => item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
  }
  return <section className="dashboard-notifications-popover" aria-label="Learning notifications">
    <header><div><p>Notifications</p><span>Learning updates</span></div><button type="button" aria-label="Close notifications" onClick={onClose}><LearningIcon name="close" size={18} /></button></header>
    {state === "loading" && <div className="dashboard-notifications-empty"><p>Loading notifications…</p></div>}
    {state === "error" && <div className="dashboard-notifications-empty"><p>Notifications are unavailable right now. Try again later.</p></div>}
    {state === "ready" && !items.length && <div className="dashboard-notifications-empty"><span className="dashboard-notifications-empty-icon"><LearningIcon name="bell" size={28} /></span><h2>You&rsquo;re all caught up.</h2><p>Account and learning updates will appear here.</p></div>}
    {state === "ready" && items.length > 0 && <ul className="learning-notification-list">{items.map((item) => <li className={item.read_at ? "" : "is-unread"} key={item.id}><strong>{item.title}</strong><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString()}</small><div>{item.href?.startsWith("/dashboard/") ? <Link href={item.href} onClick={onClose}>View details</Link> : null}{!item.read_at && <button type="button" onClick={() => void markRead(item.id)}>Mark as read</button>}</div></li>)}</ul>}
  </section>;
}
