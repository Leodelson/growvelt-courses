"use client";

import { useState, type ReactNode } from "react";
import { useLanguage } from "@/app/components/language-provider";
import { LearningIcon } from "@/app/components/learning-icon";
import { accountCopy, filterSubscriptionSummaries, type SubscriptionSummary } from "@/app/lib/learning/account-workspace";
import styles from "./account-workspace.module.css";

export function SubscriptionWorkspace({ items, statuses }: { items: (SubscriptionSummary & { content: ReactNode })[]; statuses: Record<string, string> }) {
  const { locale } = useLanguage();
  const text = accountCopy[locale];
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("default");
  const filtered = filterSubscriptionSummaries(items, query, status, sort, locale);
  function reset() { setQuery(""); setStatus("all"); setSort("default"); }
  return <div className={styles.stack}>
    <div className={styles.stats}>
      {[
        { icon: "courses" as const, value: items.length, label: text.total },
        { icon: "learning" as const, value: items.filter((item) => item.status === "active").length, label: text.active },
        { icon: "bell" as const, value: items.filter((item) => ["attention", "pending"].includes(item.status)).length, label: text.attention },
      ].map((stat) => <div className={styles.stat} key={stat.label}><LearningIcon name={stat.icon} size={23} /><div><strong>{stat.value}</strong><span>{stat.label}</span></div></div>)}
    </div>
    <div className={styles.toolbar}>
      <label>{text.subscriptionSearch}<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <label>{text.status}<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">{text.allPlans}</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>{text.sort}<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="default">{text.original}</option><option value="name">{text.name}</option><option value="date">{text.accessDate}</option></select></label>
    </div>
    <div className={styles.resultLine}><p role="status">{text.results}: <strong>{filtered.length} / {items.length}</strong></p>{(query || status !== "all" || sort !== "default") && <button type="button" onClick={reset}>{text.reset}</button>}</div>
    {filtered.length ? <div className={styles.stack}>{filtered.map((item) => <div key={item.id}>{item.content}</div>)}</div> : <div className={styles.panel}><h2>{text.noMatch}</h2><p>{text.tryAgain}</p><button className="button button-secondary" type="button" onClick={reset}>{text.reset}</button></div>}
    <aside className={styles.help} aria-labelledby="subscription-help-title"><h2 id="subscription-help-title">{text.billingHelp}</h2><details><summary>{text.accessQuestion}</summary><p>{text.accessAnswer}</p></details><details><summary>{text.cancelQuestion}</summary><p>{text.cancelAnswer}</p></details></aside>
  </div>;
}
