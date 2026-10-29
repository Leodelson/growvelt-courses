"use client";

import { FormEvent, useCallback, useState } from "react";
import Link from "@/app/components/learning-link";
import { useRouter } from "next/navigation";
import styles from "../support.module.css";

type SupportCase = { id: string; user_id: string; topic: string; subject: string; status: "open" | "waiting" | "resolved"; created_at: string; updated_at: string };
type Message = { id: string; sender_role: "customer" | "support"; body: string; created_at: string };

function formatDate(value: string) { return `${new Date(value).toISOString().slice(0, 16).replace("T", " ")} UTC`; }

export function SupportConversation({ initialCase, initialMessages, isAdmin }: { initialCase: SupportCase; initialMessages: Message[]; isAdmin: boolean }) {
  const router = useRouter();
  const [caseRecord, setCaseRecord] = useState(initialCase);
  const [messages, setMessages] = useState(initialMessages);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(`/api/learning/support/${caseRecord.id}`, { credentials: "same-origin", cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "This request could not be refreshed.");
      setCaseRecord(payload.case as SupportCase);
      setMessages(payload.messages as Message[]);
      setNotice("Request updated.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "This request could not be refreshed."); }
  }, [caseRecord.id]);

  async function sendReply(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/learning/support/${caseRecord.id}`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: reply }) });
      const payload = response.status === 204 ? null : await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "Your reply could not be sent.");
      setReply("");
      await refresh();
      setNotice("Reply sent.");
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Your reply could not be sent."); }
    finally { setBusy(false); }
  }

  async function resolveCase() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/learning/support/${caseRecord.id}`, { method: "PATCH", credentials: "same-origin" });
      const payload = response.status === 204 ? null : await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "This request could not be resolved.");
      await refresh(); setNotice("Request marked as resolved."); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "This request could not be resolved."); }
    finally { setBusy(false); }
  }

  const backHref = isAdmin ? "/dashboard/admin/support" : "/dashboard/support";
  const statusLabel = caseRecord.status === "resolved" ? "Resolved" : isAdmin ? caseRecord.status === "open" ? "Needs reply" : "Waiting on learner" : caseRecord.status === "open" ? "Awaiting Growvelt team" : "Your reply needed";
  return <main className={styles.page}>
    <Link className={styles.back} href={backHref}>← {isAdmin ? "Support inbox" : "Your support requests"}</Link>
    <header className={styles.hero}><p className="eyebrow">{isAdmin ? "Growvelt support inbox" : "Growvelt support"}</p><div className={styles.threadTitle}><div><h1>{caseRecord.subject}</h1><p>{caseRecord.topic} · opened {formatDate(caseRecord.created_at)}</p></div><span className={`${styles.status} ${caseRecord.status === "open" ? styles.open : caseRecord.status === "waiting" ? styles.waiting : styles.resolved}`}>{statusLabel}</span></div>{isAdmin && <small>Growvelt account · {caseRecord.user_id}</small>}</header>
    <section className={styles.card}><div className={styles.sectionHeading}><div><h2>Conversation</h2><p>Never include passwords, card numbers, or secret keys.</p></div><button className="button button-secondary" type="button" onClick={() => void refresh()} disabled={busy}>Refresh</button></div>
      {error && <p className={styles.error} role="alert">{error}</p>}{notice && <p className={styles.success} role="status">{notice}</p>}
      <div className={styles.thread} data-viewer={isAdmin ? "admin" : "learner"} aria-live="polite">{messages.map((message) => <article className={`${styles.message} ${message.sender_role === "support" ? styles.support : styles.customer}`} key={message.id}><strong>{isAdmin ? message.sender_role === "support" ? "You · Growvelt team" : "Learner" : message.sender_role === "support" ? "Growvelt team" : "You"}</strong><p>{message.body}</p><small>{formatDate(message.created_at)}</small></article>)}</div>
    </section>
    <form className={styles.card} onSubmit={sendReply}><h2>{caseRecord.status === "resolved" ? "Reopen this request" : "Write a reply"}</h2><p>{isAdmin ? "Your reply will be added to the learner’s Growvelt notification feed." : "A Growvelt team member will reply in this conversation."}</p><label htmlFor="support-reply">Message <span className="required-mark" aria-hidden="true">*</span></label><textarea id="support-reply" required maxLength={5000} rows={6} value={reply} onChange={(event) => setReply(event.target.value)} /><div className={styles.actions}><button className="button button-primary" type="submit" disabled={busy || !reply.trim()}>{busy ? "Sending…" : "Send reply"}</button>{isAdmin && caseRecord.status !== "resolved" && <button className="button button-secondary" type="button" disabled={busy} onClick={() => void resolveCase()}>{busy ? "Updating…" : "Mark resolved"}</button>}</div></form>
  </main>;
}
