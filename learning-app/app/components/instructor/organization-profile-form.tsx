"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Profile = {
  headline: string;
  description: string;
  contact_email: string;
  website_url: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
} | undefined;

function RequiredMark() {
  return <><span className="required-mark" aria-hidden="true">*</span><span className="sr-only"> (required)</span></>;
}

export function OrganizationProfileForm({ organizationId, organizationSlug, profile }: { organizationId: number; organizationSlug: string; profile: Profile }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/instructor/organizations/${organizationId}/profile`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline: String(form.get("headline") ?? ""),
          description: String(form.get("description") ?? ""),
          contactEmail: String(form.get("contactEmail") ?? ""),
          websiteUrl: String(form.get("websiteUrl") ?? ""),
          linkedinUrl: String(form.get("linkedinUrl") ?? ""),
          instagramUrl: String(form.get("instagramUrl") ?? ""),
        }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null) as { code?: string } | null)?.code ?? "profile_unavailable");
      setMessage("Provider profile saved. It is now visible on your public provider page.");
      router.refresh();
    } catch (error) {
      const code = error instanceof Error ? error.message : "profile_unavailable";
      setMessage(code === "verified_owner_required" ? "Only the active owner of a verified provider can update this profile." : code === "invalid_profile" ? "Check the required details and links, then try again." : "We could not save this provider profile right now. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return <form className="organization-profile-form" onSubmit={submit}>
    <p className="organization-profile-note">This is the public face of your verified provider. Do not include private documents, bank details, or sensitive personal information.</p>
    <div className="course-form-grid">
      <label className="course-field">Provider headline <RequiredMark /><input name="headline" defaultValue={profile?.headline} minLength={8} maxLength={160} required placeholder="e.g. Practical technology training for ambitious teams" /></label>
      <label className="course-field">Public contact email <RequiredMark /><input name="contactEmail" type="email" defaultValue={profile?.contact_email} minLength={5} maxLength={320} required placeholder="hello@example.com" /></label>
    </div>
    <label className="course-field">About this provider <RequiredMark /><textarea name="description" defaultValue={profile?.description} minLength={80} maxLength={2400} rows={6} required placeholder="Describe what your provider teaches, who it serves, and how learners benefit." /><span>80–2,400 characters.</span></label>
    <div className="course-form-grid">
      <label className="course-field">Website <span className="field-label-optional">(optional)</span><input name="websiteUrl" type="url" defaultValue={profile?.website_url ?? ""} maxLength={400} placeholder="https://example.com" /></label>
      <label className="course-field">LinkedIn <span className="field-label-optional">(optional)</span><input name="linkedinUrl" type="url" defaultValue={profile?.linkedin_url ?? ""} maxLength={400} placeholder="https://linkedin.com/company/example" /></label>
      <label className="course-field">Instagram <span className="field-label-optional">(optional)</span><input name="instagramUrl" type="url" defaultValue={profile?.instagram_url ?? ""} maxLength={400} placeholder="https://instagram.com/example" /></label>
    </div>
    <div className="organization-profile-actions"><button className="button button-primary" type="submit" disabled={pending}>{pending ? "Saving…" : profile ? "Save public profile" : "Publish provider profile"}</button>{profile && <Link className="button button-secondary" href={`/providers/${organizationSlug}`} target="_blank">View public profile</Link>}</div>
    {message && <p className={message.startsWith("Provider profile saved") ? "payout-profile-feedback" : "payout-profile-feedback is-error"} role="status">{message}</p>}
  </form>;
}
