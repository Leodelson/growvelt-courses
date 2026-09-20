"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function OrganizationCreateForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const slug = String(form.get("slug") ?? "").trim().toLowerCase();
    setPending(true); setMessage(null); setIsError(false);
    try {
      const response = await fetch("/api/instructor/organizations", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, slug }) });
      const result = await response.json().catch(() => null) as { code?: string } | null;
      if (!response.ok) throw new Error(result?.code ?? "organization_unavailable");
      event.currentTarget.reset(); setMessage("Your training organization is ready. You are its initial owner."); router.refresh();
    } catch (error) {
      const code = error instanceof Error ? error.message : "organization_unavailable";
      setIsError(true); setMessage(code === "organization_slug_taken" ? "That organization handle is already in use. Choose a different handle." : code === "approved_instructor_required" ? "Only an approved instructor can create an organization. Confirm this account still has approved Instructor access." : "We could not create that organization right now. Please try again shortly.");
    } finally { setPending(false); }
  }
  return <form className="organization-create-form" onSubmit={submit}>
    <p className="form-required-key"><span className="required-mark" aria-hidden="true">*</span> Required fields</p>
    <label className="course-field"><span className="field-label">Organization name <span className="required-mark" aria-hidden="true">*</span><span className="sr-only"> (required)</span></span><input name="name" placeholder="e.g. Growvelt Data Academy" maxLength={160} minLength={2} required /></label>
    <label className="course-field"><span className="field-label">Organization URL slug <span className="required-mark" aria-hidden="true">*</span><span className="sr-only"> (required)</span></span><input name="slug" placeholder="e.g. growvelt-data-academy" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={100} minLength={3} required /><span>This is your organization’s permanent short identifier. Use lowercase letters, numbers, and hyphens only. Your verified public provider page will use it later, for example learn.growvelt.com/providers/growvelt-data-academy.</span></label>
    <button className="button button-primary" type="submit" disabled={pending}>{pending ? "Creating…" : "Create organization"}</button>
    {message && <p className={isError ? "payout-profile-feedback is-error" : "payout-profile-feedback"} role="status">{message}</p>}
  </form>;
}
