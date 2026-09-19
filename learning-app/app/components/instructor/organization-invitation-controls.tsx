"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function OrganizationInvitationForm({ organizationId }: { organizationId: number }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [message, setMessage] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending) return;
    const form = new FormData(event.currentTarget); const email = String(form.get("email") ?? "").trim(); const role = String(form.get("role") ?? "");
    setPending(true); setMessage(null);
    try { const response = await fetch(`/api/instructor/organizations/${organizationId}/invitations`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role }) }); if (!response.ok) throw new Error("unavailable"); event.currentTarget.reset(); setMessage("Invitation created. The instructor must accept it from their organization workspace."); router.refresh(); }
    catch { setMessage("We could not create that invitation. The person must already be an approved Growvelt instructor and not an active member."); }
    finally { setPending(false); }
  }
  return <form className="organization-invitation-form" onSubmit={submit}><label className="course-field">Approved instructor email<input name="email" type="email" maxLength={320} required /></label><label className="course-field">Organization role<select name="role" defaultValue="instructor"><option value="instructor">Instructor</option><option value="admin">Admin</option></select></label><button className="button button-secondary" disabled={pending}>{pending ? "Inviting…" : "Invite"}</button>{message && <p className="payout-profile-feedback" role="status">{message}</p>}</form>;
}

export function OrganizationInvitationAcceptance({ invitationId }: { invitationId: number }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [message, setMessage] = useState<string | null>(null);
  async function accept() { if (pending) return; setPending(true); setMessage(null); try { const response = await fetch(`/api/instructor/organization-invitations/${invitationId}/accept`, { method: "POST", credentials: "same-origin" }); if (!response.ok) throw new Error("unavailable"); setMessage("Organization invitation accepted."); router.refresh(); } catch { setMessage("We could not accept this invitation safely. Refresh and try again."); } finally { setPending(false); } }
  return <div className="organization-invitation-acceptance"><button className="button button-primary" type="button" onClick={accept} disabled={pending}>{pending ? "Accepting…" : "Accept invitation"}</button>{message && <p className="payout-profile-feedback" role="status">{message}</p>}</div>;
}
