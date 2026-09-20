"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ConfirmationDialog } from "@/app/components/ui/confirmation-dialog";

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
  return <form className="organization-invitation-form" onSubmit={submit}><p className="form-required-key"><span className="required-mark" aria-hidden="true">*</span> Required fields</p><label className="course-field"><span className="field-label">Approved instructor email <span className="required-mark" aria-hidden="true">*</span><span className="sr-only"> (required)</span></span><input name="email" type="email" placeholder="instructor@example.com" maxLength={320} required /><span>The person must already have an approved Growvelt instructor account. They will receive an email and can accept the invitation from their Organizations page.</span></label><label className="course-field"><span className="field-label">Organization role <span className="required-mark" aria-hidden="true">*</span><span className="sr-only"> (required)</span></span><select name="role" defaultValue="instructor" required><option value="instructor">Instructor</option><option value="admin">Admin</option></select><span>Admins can help organize the provider workspace. This phase does not give either role control over another instructor’s personal earnings.</span></label><button className="button button-secondary" disabled={pending}>{pending ? "Inviting…" : "Invite instructor"}</button>{feedback && <p className={`payout-profile-feedback${feedback.kind === "error" ? " is-error" : ""}`} role="status">{feedback.text}</p>}</form>;
}

export function OrganizationInvitationAcceptance({ invitationId }: { invitationId: number }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [message, setMessage] = useState<string | null>(null); const [confirmDecline, setConfirmDecline] = useState(false);
  async function respond(kind: "accept" | "decline") { if (pending) return; setPending(true); setMessage(null); try { const response = await fetch(`/api/instructor/organization-invitations/${invitationId}/${kind}`, { method: "POST", credentials: "same-origin" }); const result = await response.json().catch(() => null) as { notification?: "sent" | "not_configured" | "failed" } | null; if (!response.ok) throw new Error("unavailable"); setMessage(kind === "accept" ? result?.notification === "sent" ? "Organization invitation accepted. The organization owner has been notified by email." : "Organization invitation accepted." : "Organization invitation declined."); setConfirmDecline(false); router.refresh(); } catch { setMessage(kind === "accept" ? "We could not accept this invitation safely. Refresh and try again." : "We could not decline this invitation safely. Refresh and try again."); setConfirmDecline(false); } finally { setPending(false); } }
  return <div className="organization-invitation-acceptance"><div className="organization-action-buttons"><button className="button button-primary" type="button" onClick={() => respond("accept")} disabled={pending}>{pending ? "Responding…" : "Accept invitation"}</button><button className="button button-secondary" type="button" onClick={() => setConfirmDecline(true)} disabled={pending}>Decline invitation</button></div>{message && <p className="payout-profile-feedback" role="status">{message}</p>}{confirmDecline && <ConfirmationDialog title="Decline organization invitation?" description={<p>You will not be added to this organization. The owner can send a new invitation later if needed.</p>} confirmLabel="Decline invitation" pendingLabel="Declining…" tone="danger" isPending={pending} onCancel={() => setConfirmDecline(false)} onConfirm={() => respond("decline")} />}</div>;
}

export function OrganizationInvitationCancellation({ organizationId, invitationId }: { organizationId: number; invitationId: number }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [message, setMessage] = useState<string | null>(null); const [confirmCancel, setConfirmCancel] = useState(false);
  async function cancel() { if (pending) return; setPending(true); setMessage(null); try { const response = await fetch(`/api/instructor/organizations/${organizationId}/invitations/${invitationId}/cancel`, { method: "POST", credentials: "same-origin" }); if (!response.ok) throw new Error("unavailable"); setMessage("Invitation cancelled."); setConfirmCancel(false); router.refresh(); } catch { setMessage("We could not cancel this invitation. Refresh and try again."); setConfirmCancel(false); } finally { setPending(false); } }
  return <div className="organization-management-action"><button className="text-button text-button-danger" type="button" onClick={() => setConfirmCancel(true)} disabled={pending}>Cancel invitation</button>{message && <small role="status">{message}</small>}{confirmCancel && <ConfirmationDialog title="Cancel this invitation?" description={<p>The instructor will no longer be able to accept it. You can send a new invitation later if needed.</p>} confirmLabel="Cancel invitation" pendingLabel="Cancelling…" tone="danger" isPending={pending} onCancel={() => setConfirmCancel(false)} onConfirm={cancel} />}</div>;
}

export function OrganizationMemberRevocation({ organizationId, memberId, memberName }: { organizationId: number; memberId: string; memberName: string }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [message, setMessage] = useState<string | null>(null); const [confirmRemoval, setConfirmRemoval] = useState(false);
  async function revoke() { if (pending) return; setPending(true); setMessage(null); try { const response = await fetch(`/api/instructor/organizations/${organizationId}/members/${memberId}/revoke`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }); if (!response.ok) throw new Error("unavailable"); setMessage("Member removed from this organization."); setConfirmRemoval(false); router.refresh(); } catch { setMessage("We could not remove this member. Refresh and try again."); setConfirmRemoval(false); } finally { setPending(false); } }
  return <div className="organization-management-action"><button className="text-button text-button-danger" type="button" onClick={() => setConfirmRemoval(true)} disabled={pending}>Remove member</button>{message && <small role="status">{message}</small>}{confirmRemoval && <ConfirmationDialog title={`Remove ${memberName}?`} description={<p>This removes their organization access only. Their individual courses and earnings will not be deleted.</p>} confirmLabel="Remove member" pendingLabel="Removing…" tone="danger" isPending={pending} onCancel={() => setConfirmRemoval(false)} onConfirm={revoke} />}</div>;
}
