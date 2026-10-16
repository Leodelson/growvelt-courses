"use client";

import { useState } from "react";
import { ActionButton } from "@/app/components/ui/action-button";
import { ConfirmationDialog } from "@/app/components/ui/confirmation-dialog";

export function ProviderVerificationReviewForm({ organizationId }: { organizationId: number }) {
  const [note, setNote] = useState(""); const [pending, setPending] = useState<"verified" | "rejected" | null>(null); const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState<"verified" | "rejected" | null>(null);
  function requestDecision(decision: "verified" | "rejected") {
    if (pending) return;
    if (decision === "rejected" && note.trim().length < 10) { setMessage("Give the provider a rejection note of at least 10 characters."); return; }
    setMessage(""); setConfirmation(decision);
  }
  async function review(decision: "verified" | "rejected") { if (pending) return; if (decision === "rejected" && note.trim().length < 10) { setMessage("Give the provider a rejection note of at least 10 characters."); return; } setPending(decision); setMessage(""); try { const response = await fetch(`/api/admin/provider-verifications/${organizationId}/review`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, note }) }); if (!response.ok) throw new Error(); window.location.reload(); } catch { setMessage("We could not record this decision. Refresh and try again."); setPending(null); } }
  return <div className="provider-verification-review"><label className="admin-field">Verification review note <span>(required when rejecting; shown to the provider)</span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={3} disabled={Boolean(pending)} /><span>{note.length} / 2000</span></label>{message && <p className="payout-profile-feedback is-error" role="status">{message}</p>}<div className="admin-review-actions"><ActionButton className="button button-secondary" type="button" onClick={() => requestDecision("rejected")} disabled={Boolean(pending)} isPending={pending === "rejected"} pendingLabel="Rejecting…">Reject verification</ActionButton><ActionButton className="button button-primary" type="button" onClick={() => requestDecision("verified")} disabled={Boolean(pending)} isPending={pending === "verified"} pendingLabel="Approving…">Approve provider</ActionButton></div>{confirmation && <ConfirmationDialog title={confirmation === "verified" ? "Approve this provider?" : "Reject provider verification?"} description={<p>{confirmation === "verified" ? "This approves the provider’s verified status. A saved provider profile and identity may become public under the existing provider rules." : "This records a rejected verification decision and the review note. The provider can update its details and resubmit."}</p>} confirmLabel={confirmation === "verified" ? "Approve provider" : "Reject verification"} pendingLabel={confirmation === "verified" ? "Approving…" : "Rejecting…"} tone={confirmation === "verified" ? "primary" : "danger"} isPending={Boolean(pending)} onCancel={() => !pending && setConfirmation(null)} onConfirm={() => { if(confirmation)void review(confirmation).finally(()=>setConfirmation(null)); }} />}</div>;
}
