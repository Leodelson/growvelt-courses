"use client";

import { FormEvent, useRef, useState } from "react";
import { ActionButton } from "@/app/components/ui/action-button";
import { InlineFeedback } from "@/app/components/ui/inline-feedback";
import type { InstructorApplicationIdentity } from "@/app/lib/instructor/application";
import { createClient } from "@/app/lib/supabase/browser";

export function InstructorApplicationForm({ identity }: { identity: InstructorApplicationIdentity }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pendingRef = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    const values = new FormData(event.currentTarget);
    const country = String(values.get("country") ?? "").trim();
    const yearsExperienceValue = String(values.get("years_experience") ?? "").trim();
    const yearsExperience = Number(yearsExperienceValue);
    const portfolioUrl = String(values.get("portfolio_url") ?? "").trim();

    if (!country || !yearsExperienceValue || !Number.isInteger(yearsExperience) || yearsExperience < 0 || yearsExperience > 60) {
      setMessage("Add your country and a whole number of professional years between 0 and 60.");
      return;
    }

    if (portfolioUrl) {
      try {
        const url = new URL(portfolioUrl);
        if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Unsupported URL protocol");
      } catch {
        setMessage("Use a full http or https URL for your optional professional link.");
        return;
      }
    }

    const expertise = String(values.get("expertise") ?? "").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 12);
    pendingRef.current = true;
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user.id) throw new Error("Authentication required");
      const { error } = await supabase.from("instructor_profiles").insert({
        user_id: session.user.id,
        country,
        phone: String(values.get("phone") ?? "").trim() || null,
        headline: String(values.get("headline") ?? "").trim(),
        expertise,
        years_experience: yearsExperience,
        teaching_experience: String(values.get("teaching_experience") ?? "").trim(),
        bio: String(values.get("bio") ?? "").trim(),
        motivation: String(values.get("motivation") ?? "").trim(),
        portfolio_url: portfolioUrl || null,
      });
      if (error) throw error;
      window.location.assign("/teach/application");
    } catch {
      setMessage("We couldn’t submit your application. If you have already applied, view your application status instead.");
      setBusy(false);
      pendingRef.current = false;
    }
  }

  return <form className="instructor-application-form" onSubmit={submit}>
    <div className="application-account-summary" aria-label="Application account">
      <p className="eyebrow">Your Learning account</p>
      <strong>{identity.fullName || "Growvelt Learning applicant"}</strong>
      <span>{identity.email || "Your authenticated account email"}</span>
      <small>Your account identity is used for this application and cannot be changed here.</small>
    </div>
    <div className="instructor-form-grid">
      <label>Country<input name="country" required maxLength={100} autoComplete="country-name" placeholder="e.g. Nigeria" disabled={busy} /></label>
      <label>Phone <span>(optional)</span><input name="phone" type="tel" maxLength={32} autoComplete="tel" placeholder="e.g. +234 800 000 0000" disabled={busy} /></label>
    </div>
    <label>Professional headline<input name="headline" required maxLength={160} placeholder="e.g. Data analyst and practical SQL educator" disabled={busy} /></label>
    <label>Areas of expertise<input name="expertise" required placeholder="e.g. SQL, data analysis, Power BI" disabled={busy} /><small>Separate up to 12 areas with commas.</small></label>
    <label>Years of professional experience<input name="years_experience" required type="number" min="0" max="60" step="1" inputMode="numeric" placeholder="e.g. 6" disabled={busy} /></label>
    <label>Teaching experience<textarea name="teaching_experience" required maxLength={1500} rows={4} placeholder="Describe any teaching, mentoring, workshop, or training experience you have." disabled={busy} /></label>
    <label>Professional background and practical experience<textarea name="bio" required maxLength={2000} rows={6} placeholder="Share the practical experience you bring and the learners you are well placed to help." disabled={busy} /></label>
    <label>Why do you want to teach on Growvelt?<textarea name="motivation" required maxLength={1500} rows={5} placeholder="Tell us what you want learners to gain from the courses you would create." disabled={busy} /></label>
    <label>Portfolio, LinkedIn, or professional website <span>(optional)</span><input name="portfolio_url" type="url" maxLength={500} inputMode="url" placeholder="https://" disabled={busy} /><small>Use a public professional link that helps us understand your work.</small></label>
    <p className="instructor-form-note">Applications are reviewed before teaching access is granted. Please teach only with content you own, created, or are authorized to use.</p>
    {message && <InlineFeedback variant="error">{message}</InlineFeedback>}
    <ActionButton className="button button-primary" type="submit" isPending={busy} pendingLabel="Submitting application…">Submit application</ActionButton>
  </form>;
}
