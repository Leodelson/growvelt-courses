"use client";

import { useState } from "react";
import styles from "./learning-email-preferences.module.css";

export function LearningEmailPreferences({ initialValue }: { initialValue: boolean }) {
  const [enabled, setEnabled] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function update(value: boolean) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/learning/email/preferences", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ marketingOptIn: value }) });
      if (!response.ok) throw new Error();
      setEnabled(value);
    } catch { setError("Your preference could not be saved. Please try again."); }
    finally { setBusy(false); }
  }
  return <div className={styles.preference}><div className={styles.copy}><div className={styles.titleLine}><strong>Optional marketing emails</strong><span className={enabled ? styles.statusOn : styles.statusOff} aria-live="polite">{busy ? "Saving…" : enabled ? "On" : "Off"}</span></div><p id="learning-marketing-email-copy">Course news and offers from Growvelt. You can change this at any time. Essential account and security messages are separate.</p>{error && <p className={styles.error} role="alert">{error}</p>}</div><button type="button" className={styles.switch} role="switch" aria-label="Optional marketing emails" aria-describedby="learning-marketing-email-copy" aria-checked={enabled} disabled={busy} onClick={() => void update(!enabled)}><span /></button></div>;
}
