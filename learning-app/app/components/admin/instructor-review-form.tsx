"use client";

import { useState } from "react";
import { createClient } from "@/app/lib/supabase/browser";

type Decision = "approved" | "rejected";

export function InstructorReviewForm({ userId }: { userId: string }) {
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function review(nextDecision: Decision) {
    const verb = nextDecision === "approved" ? "approve" : "reject";
    if (!window.confirm(`Are you sure you want to ${verb} this Instructor application? This decision cannot be changed here.`)) return;

    setBusy(true);
    setMessage("");
    setDecision(nextDecision);
    try {
      const { error } = await createClient().rpc("review_instructor_application", {
        p_application_user_id: userId,
        p_decision: nextDecision,
        p_review_note: note.trim() || null,
      });
      if (error) throw error;
      window.location.reload();
    } catch {
      setMessage("The application could not be reviewed. Refresh the page to confirm its current status.");
      setBusy(false);
      setDecision(null);
    }
  }

  return <section className="admin-review-panel" aria-labelledby="review-title">
    <div><p className="eyebrow">Review decision</p><h2 id="review-title">Approve or reject</h2><p>This is an internal note for the current decision. It is not shown to the applicant.</p></div>
    <label className="admin-field">Internal review note <span>(optional)</span><textarea value={note} maxLength={2000} rows={5} onChange={(event) => setNote(event.target.value)} disabled={busy} /></label>
    {message && <p className="auth-message" role="status">{message}</p>}
    <div className="admin-review-actions"><button className="button button-secondary" type="button" onClick={() => review("rejected")} disabled={busy}>{busy && decision === "rejected" ? "Rejecting…" : "Reject application"}</button><button className="button button-primary" type="button" onClick={() => review("approved")} disabled={busy}>{busy && decision === "approved" ? "Approving…" : "Approve Instructor"}</button></div>
  </section>;
}
