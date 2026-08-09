"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/app/lib/supabase/browser";

export function InstructorApplicationForm() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const expertise = String(values.get("expertise") ?? "").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 12);
    setBusy(true); setMessage("");
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user.id) throw new Error("Authentication required");
      const { error } = await supabase.from("instructor_profiles").insert({
        user_id: session.user.id,
        headline: String(values.get("headline") ?? "").trim(),
        expertise,
        bio: String(values.get("bio") ?? "").trim(),
      });
      if (error) throw error;
      window.location.assign("/teach/application");
    } catch {
      setMessage("We couldn’t submit your application. If you have already applied, view your application status instead.");
      setBusy(false);
    }
  }

  return <form className="instructor-application-form" onSubmit={submit}>
    <label>Professional headline<input name="headline" required maxLength={160} placeholder="e.g. Data analyst and practical SQL educator" disabled={busy} /></label>
    <label>Areas of expertise<input name="expertise" required placeholder="e.g. SQL, data analysis, Power BI" disabled={busy} /><small>Separate areas with commas.</small></label>
    <label>About your experience and teaching goals<textarea name="bio" required maxLength={2000} rows={7} placeholder="Share the experience you bring, who you hope to help, and how you approach practical learning." disabled={busy} /></label>
    <p className="instructor-form-note">Applications are reviewed before teaching access is granted. Submitting this form does not create Instructor access.</p>
    {message && <p className="auth-message" role="status">{message}</p>}
    <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit application"}</button>
  </form>;
}
