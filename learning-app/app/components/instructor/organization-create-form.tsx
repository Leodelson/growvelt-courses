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
      if (!response.ok) throw new Error("unavailable");
      event.currentTarget.reset(); setMessage("Your training organization is ready. You are its initial owner."); router.refresh();
    } catch {
      setIsError(true); setMessage("We could not create that organization. Check the name and URL slug, then try again.");
    } finally { setPending(false); }
  }
  return <form className="organization-create-form" onSubmit={submit}>
    <label className="course-field">Organization name<input name="name" placeholder="e.g. Growvelt Data Academy" maxLength={160} minLength={2} required /></label>
    <label className="course-field">Organization URL slug<input name="slug" placeholder="e.g. growvelt-data-academy" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={100} minLength={3} required /><span>This is your organization’s permanent short identifier. Use lowercase letters, numbers, and hyphens only. A public organization profile URL is not published in this phase.</span></label>
    <button className="button button-primary" type="submit" disabled={pending}>{pending ? "Creating…" : "Create organization"}</button>
    {message && <p className={isError ? "payout-profile-feedback is-error" : "payout-profile-feedback"} role="status">{message}</p>}
  </form>;
}
