"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import styles from "./workspace.module.css";

type Audience = "learners" | "instructors" | "organizations";
type Campaign = { id: string; audience: Audience; subject: string; headline: string; body: string; status: string; sent_count: number; failed_count: number; created_at: string };
type State = { campaigns: Campaign[]; counts: Record<Audience, number> };
const labels: Record<Audience, string> = { learners: "Learners", instructors: "Approved instructors", organizations: "Organization owners and admins" };

export function LearningEmailCenter() {
  const [data, setData] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [audience, setAudience] = useState<Audience>("learners");
  const [subject, setSubject] = useState("");
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [result, setResult] = useState("");
  const refresh = useCallback(async () => {
    const response = await fetch("/api/learning/admin/emails", { credentials: "same-origin", cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Email Center is unavailable.");
    setData(payload as State);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/learning/admin/emails", { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Email Center is unavailable."); return payload as State; })
      .then((payload) => { if (!controller.signal.aborted) setData(payload); })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, []);

  async function saveDraft(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setResult("");
    try {
      const response = await fetch("/api/learning/admin/emails", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", audience, subject, headline, body }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Draft could not be saved.");
      setSelected(payload.id); setConfirmation(""); setResult("Draft saved. No emails were sent.");
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Draft could not be saved."); }
    finally { setBusy(false); }
  }

  async function sendBatch() {
    if (!selected || confirmation !== "SEND LEARNING EMAILS") return;
    setBusy(true); setError(""); setResult("");
    try {
      const response = await fetch("/api/learning/admin/emails", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send", campaignId: selected, confirmation }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "This batch could not be sent.");
      setResult(payload.remaining ? `${payload.accepted} accepted by the email provider in this batch; ${payload.failed} failed. Final delivery is not confirmed. Review before sending another batch.` : "No eligible recipients remain. This campaign is complete.");
      setConfirmation("");
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "This batch could not be sent."); }
    finally { setBusy(false); }
  }

  const active = data?.campaigns.find((campaign) => campaign.id === selected);
  return <main className={styles.page}>
    <header className={styles.hero}><p className="eyebrow">Learning administration</p><h1>Email Center</h1><p>Compose Learning updates for people who opted in. Careers accounts and lists are separate. Saving a draft never sends an email.</p></header>
    {error && <p className={styles.error} role="alert">{error}</p>}{result && <p className={styles.result} role="status">{result}</p>}
    <div className={styles.grid}>
      <form className={styles.card} onSubmit={saveDraft}><h2>New campaign</h2><p>Plain text is formatted in Growvelt&rsquo;s email layout. Links and HTML pasted into the message are treated as text.</p>
        <label>Audience<select value={audience} onChange={(event) => setAudience(event.target.value as Audience)}>{Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <p className={styles.count}>{data ? `${data.counts[audience] ?? 0} opted-in recipients currently eligible` : "Checking opted-in recipients…"}</p>
        <label>Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} minLength={3} maxLength={160} required /></label>
        <label>Headline<input value={headline} onChange={(event) => setHeadline(event.target.value)} minLength={3} maxLength={160} required /></label>
        <label>Message<textarea rows={9} value={body} onChange={(event) => setBody(event.target.value)} minLength={10} maxLength={4000} required /></label>
        <button className="button button-primary" type="submit" disabled={busy}>Save draft</button>
      </form>
      <section className={styles.card}><h2>Preview</h2><p className={styles.previewLabel}>Subject</p><strong>{subject || "Your subject will appear here"}</strong><div className={styles.preview}><p className="eyebrow">GROWVELT LEARNING</p><h3>{headline || "Your headline"}</h3><p>{body || "Your message preview will appear here."}</p><small>Includes Growvelt footer and an unsubscribe link in the sent email.</small></div><p className={styles.note}>Preview is local. It does not contact the email provider.</p></section>
    </div>
    <section className={styles.card}><h2>Saved campaigns</h2>{!data ? <p>Loading campaigns…</p> : !data.campaigns.length ? <p>No campaigns yet.</p> : <div className={styles.campaigns}>{data.campaigns.map((campaign) => <button type="button" className={selected === campaign.id ? styles.selected : ""} key={campaign.id} onClick={() => { setSelected(campaign.id); setConfirmation(""); setResult(""); }}><strong>{campaign.subject}</strong><span>{labels[campaign.audience]} · {campaign.status} · {campaign.sent_count} accepted, {campaign.failed_count} failed</span></button>)}</div>}</section>
    {active && <section className={styles.card}><h2>Send: {active.subject}</h2><p>Only opted-in {labels[active.audience].toLowerCase()} are eligible. Each confirmed click attempts at most 3 recipients. Provider acceptance does not prove delivery. Failed or interrupted claims are not retried automatically.</p><p><strong>{active.sent_count} accepted</strong> · {active.failed_count} failed</p><label>Type SEND LEARNING EMAILS to confirm this batch<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" /></label><button className="button button-primary" type="button" disabled={busy || confirmation !== "SEND LEARNING EMAILS" || active.status === "sent"} onClick={() => void sendBatch()}>{busy ? "Sending…" : "Send next batch (up to 3)"}</button></section>}
  </main>;
}
