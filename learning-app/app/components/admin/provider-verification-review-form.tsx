"use client";

import { useState } from "react";

export function ProviderVerificationReviewForm({ organizationId }: { organizationId: number }) {
  const [note, setNote] = useState(""); const [pending, setPending] = useState<"verified" | "rejected" | null>(null); const [message, setMessage] = useState("");
  async function review(decision: "verified" | "rejected") { if (pending) return; if (decision === "rejected" && note.trim().length < 10) { setMessage("Give the provider a rejection note of at least 10 characters."); return; } setPending(decision); setMessage(""); try { const response = await fetch(`/api/admin/provider-verifications/${organizationId}/review`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, note }) }); if (!response.ok) throw new Error(); window.location.reload(); } catch { setMessage("We could not record this decision. Refresh and try again."); setPending(null); } }
  return <div className="provider-verification-review"><label className="admin-field">Internal review note <span>(required when rejecting)</span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={3} disabled={Boolean(pending)} /></label>{message && <p className="payout-profile-feedback is-error" role="status">{message}</p>}<div className="admin-review-actions"><button className="button button-secondary" type="button" onClick={() => review("rejected")} disabled={Boolean(pending)}>{pending === "rejected" ? "Rejecting…" : "Reject verification"}</button><button className="button button-primary" type="button" onClick={() => review("verified")} disabled={Boolean(pending)}>{pending === "verified" ? "Approving…" : "Approve provider"}</button></div></div>;
}
