"use client";

import { useState } from "react";

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
  return <div className="learning-email-preferences"><strong>Marketing emails: {enabled ? "On" : "Off"}</strong><p>Optional course news and offers from Growvelt. You can change this at any time. Essential account and course messages are separate.</p><button type="button" className="button button-secondary" disabled={busy} onClick={() => void update(!enabled)}>{busy ? "Saving…" : enabled ? "Turn off marketing emails" : "Get Growvelt updates"}</button>{error && <p role="alert">{error}</p>}</div>;
}
