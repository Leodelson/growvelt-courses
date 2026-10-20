"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./support.module.css";

const topics = [
  ["courses", "Courses and lessons"], ["billing", "Payments and subscriptions"],
  ["teaching", "Teaching"], ["organizations", "Organization learning"],
  ["account", "Account access"], ["other", "Something else"],
] as const;

export function SupportCaseForm() {
  const router = useRouter();
  const [topic, setTopic] = useState("courses");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/learning/support", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, subject, message }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Request could not be sent.");
      router.push(`/dashboard/support/${payload.id}`);
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Request could not be sent."); }
    finally { setBusy(false); }
  }
  return <form className={styles.card} onSubmit={submit}><h2>Ask the Learning team</h2><p>For a course, payment, teaching, or organization question. Never include a password, card number, or secret key.</p>
    <label>Topic<select value={topic} onChange={(event) => setTopic(event.target.value)}>{topics.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    <label>Subject<input required minLength={5} maxLength={160} value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
    <label>What happened?<textarea required rows={7} minLength={20} maxLength={5000} value={message} onChange={(event) => setMessage(event.target.value)} /></label>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <button className="button button-primary" disabled={busy} type="submit">{busy ? "Sending…" : "Send support request"}</button>
  </form>;
}
