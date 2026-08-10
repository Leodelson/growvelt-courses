"use client";

import { useRef, useState } from "react";
import { ActionButton } from "@/app/components/ui/action-button";
import { InlineFeedback } from "@/app/components/ui/inline-feedback";
import { createClient } from "@/app/lib/supabase/browser";

type Decision = "approved" | "rejected";

type ReviewRpcError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

function isReviewRpcError(error: unknown): error is ReviewRpcError {
  return typeof error === "object" && error !== null && "message" in error;
}

function reviewFailureMessage(error: unknown) {
  if (!isReviewRpcError(error)) return "The application could not be reviewed. Refresh the page and try again.";

  if (error.code === "42501") return "Your Admin access could not be verified. Refresh the page and try again.";
  if (error.code === "P0001") return "This application has already been finalized. Refresh the page to confirm its current status.";
  if (error.code === "P0002") return "This application is no longer available. Return to the application queue and refresh it.";
  if (error.code === "23503" || error.code === "23514") return "The review could not be recorded because required Learning account data is incomplete. Contact a Learning administrator.";

  return "The application could not be reviewed. Refresh the page and try again.";
}

export function InstructorReviewForm({ userId }: { userId: string }) {
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pendingRef = useRef(false);

  async function review(nextDecision: Decision) {
    if (pendingRef.current) return;
    const verb = nextDecision === "approved" ? "approve" : "reject";
    if (!window.confirm(`Are you sure you want to ${verb} this Instructor application? This decision cannot be changed here.`)) return;

    pendingRef.current = true;
    setBusy(true);
    setMessage("");
    setDecision(nextDecision);
    try {
      const { error } = await createClient().rpc("review_instructor_application", {
        p_application_user_id: userId,
        p_decision: nextDecision,
        p_review_note: note.trim() || null,
      });
      if (error) {
        // The server keeps the operation atomic. Preserve the actual PostgREST
        // response in the Admin browser console for operational diagnosis while
        // keeping the on-screen message safe and actionable.
        console.error("Instructor application review RPC failed", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw error;
      }
      window.location.reload();
    } catch (error) {
      setMessage(reviewFailureMessage(error));
      setBusy(false);
      setDecision(null);
      pendingRef.current = false;
    }
  }

  return <section className="admin-review-panel" aria-labelledby="review-title">
    <div><p className="eyebrow">Review decision</p><h2 id="review-title">Approve or reject</h2><p>This is an internal note for the current decision. It is not shown to the applicant.</p></div>
    <label className="admin-field">Internal review note <span>(optional)</span><textarea value={note} maxLength={2000} rows={5} onChange={(event) => setNote(event.target.value)} disabled={busy} /></label>
    {message && <InlineFeedback variant="error">{message}</InlineFeedback>}
    <div className="admin-review-actions"><ActionButton className="button button-secondary" type="button" onClick={() => review("rejected")} isPending={busy && decision === "rejected"} pendingLabel="Rejecting…" disabled={busy}>Reject application</ActionButton><ActionButton className="button button-primary" type="button" onClick={() => review("approved")} isPending={busy && decision === "approved"} pendingLabel="Approving…" disabled={busy}>Approve Instructor</ActionButton></div>
  </section>;
}
