"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function OrganizationInvitationForm({ organizationId }: { organizationId: number }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const successStorageKey = `growvelt-organization-invitation-success-${organizationId}`;
  useEffect(() => {
    const saved = window.sessionStorage.getItem(successStorageKey);
    if (!saved) return;
    window.sessionStorage.removeItem(successStorageKey);
    setFeedback({ kind: "success", text: saved });
  }, [successStorageKey]);
  const failureMessage = (code?: string) => code === "invitee_not_found" ? "That email does not belong to a Growvelt Learning account yet." : code === "invitee_not_approved" ? "That account has not been approved as a Growvelt instructor yet." : code === "already_member" ? "That instructor is already an active member of this organization." : code === "organization_access_denied" ? "Your active Owner access could not be verified. Refresh and try again." : "We could not confirm that invitation. Please refresh once before trying again.";
  function showSavedInvitation(text: string) {
    setFeedback({ kind: "success", text });
    window.setTimeout(() => {
      window.sessionStorage.setItem(successStorageKey, text);
      router.refresh();
    }, 4500);
  }
  async function confirmSavedInvitation(email: string) {
    const response = await fetch(`/api/instructor/organizations/${organizationId}/invitations?email=${encodeURIComponent(email)}`, { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) return false;
    const data = await response.json() as { invitation?: unknown };
    return Boolean(data.invitation);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending) return;
    const form = new FormData(event.currentTarget); const email = String(form.get("email") ?? "").trim(); const role = String(form.get("role") ?? "");
    setPending(true); setFeedback(null);
    try {
      const response = await fetch(`/api/instructor/organizations/${organizationId}/invitations`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role }) });
      const result = await response.json().catch(() => null) as { code?: string; notification?: "sent" | "not_configured" | "failed" } | null;
      if (!response.ok) {
        if (await confirmSavedInvitation(email)) {
          event.currentTarget.reset(); showSavedInvitation("Invitation is already saved and pending acceptance. We will not create a duplicate."); return;
        }
        setFeedback({ kind: "error", text: failureMessage(result?.code) }); return;
      }
      event.currentTarget.reset();
      showSavedInvitation(result?.notification === "sent" ? "Invitation sent. The instructor has been emailed and can accept it from their Organizations page." : result?.notification === "not_configured" ? "Invitation sent and is pending acceptance. Email delivery is not configured yet, so let the instructor know to sign in and open Organizations." : "Invitation sent and is pending acceptance. We could not send the email notice, so let the instructor know to sign in and open Organizations.");
    }
    catch {
      if (await confirmSavedInvitation(email).catch(() => false)) {
        event.currentTarget.reset(); showSavedInvitation("Invitation is already saved and pending acceptance. We will not create a duplicate.");
      } else setFeedback({ kind: "error", text: "We could not confirm that invitation. Please refresh once before trying again." });
    }
    finally { setPending(false); }
  }
  return <form className="organization-invitation-form" onSubmit={submit}><label className="course-field">Approved instructor email<input name="email" type="email" placeholder="instructor@example.com" maxLength={320} required /><span>The person must already have an approved Growvelt instructor account. They will receive an email and can accept the invitation from their Organizations page.</span></label><label className="course-field">Organization role<select name="role" defaultValue="instructor"><option value="instructor">Instructor</option><option value="admin">Admin</option></select><span>Admins can help organize the provider workspace. This phase does not give either role control over another instructor’s personal earnings.</span></label><button className="button button-secondary" disabled={pending}>{pending ? "Inviting…" : "Invite instructor"}</button>{feedback && <p className={`payout-profile-feedback${feedback.kind === "error" ? " is-error" : ""}`} role="status">{feedback.text}</p>}</form>;
}

export function OrganizationInvitationAcceptance({ invitationId }: { invitationId: number }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [message, setMessage] = useState<string | null>(null);
  async function accept() { if (pending) return; setPending(true); setMessage(null); try { const response = await fetch(`/api/instructor/organization-invitations/${invitationId}/accept`, { method: "POST", credentials: "same-origin" }); const result = await response.json().catch(() => null) as { notification?: "sent" | "not_configured" | "failed" } | null; if (!response.ok) throw new Error("unavailable"); setMessage(result?.notification === "sent" ? "Organization invitation accepted. The organization owner has been notified by email." : "Organization invitation accepted."); router.refresh(); } catch { setMessage("We could not accept this invitation safely. Refresh and try again."); } finally { setPending(false); } }
  return <div className="organization-invitation-acceptance"><button className="button button-primary" type="button" onClick={accept} disabled={pending}>{pending ? "Accepting…" : "Accept invitation"}</button>{message && <p className="payout-profile-feedback" role="status">{message}</p>}</div>;
}
