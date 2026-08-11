"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/app/components/ui/action-button";
import { ConfirmationDialog } from "@/app/components/ui/confirmation-dialog";
import { InlineFeedback } from "@/app/components/ui/inline-feedback";
import { createClient } from "@/app/lib/supabase/browser";

type Decision = "published" | "returned";

export function CourseModerationForm({ courseId }: { courseId: number }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function requestDecision(nextDecision: Decision) {
    if (isPending) return;
    if (nextDecision === "returned" && note.trim().length < 2) {
      setMessage("Explain what needs to change before returning this course.");
      return;
    }
    setMessage(null);
    setDecision(nextDecision);
  }

  async function reviewCourse() {
    if (!decision || isPending) return;
    setIsPending(true);
    setMessage(null);
    const { error } = await createClient().rpc("review_learning_course", { p_course_id: courseId, p_decision: decision, p_review_note: note.trim() || null });
    setIsPending(false);
    if (error) {
      setDecision(null);
      setMessage("The course could not be reviewed. Refresh the page and confirm its current status.");
      return;
    }
    router.push("/dashboard/admin/courses");
    router.refresh();
  }

  return <section className="admin-review-panel" aria-labelledby="course-review-title">
    <div><p className="eyebrow">Review decision</p><h2 id="course-review-title">Publish or return</h2><p>Return notes are internal to Growvelt in this phase. The Instructor receives a safe generic returned-for-changes status.</p></div>
    <label className="admin-field">Review note <span>{"Required when returning for changes; optional when publishing."}</span><textarea value={note} maxLength={2000} rows={5} onChange={(event) => setNote(event.target.value)} disabled={isPending} /></label>
    {message && <InlineFeedback variant="error">{message}</InlineFeedback>}
    <div className="admin-review-actions"><ActionButton className="button button-secondary" type="button" onClick={() => requestDecision("returned")} disabled={isPending} isPending={isPending && decision === "returned"} pendingLabel="Returning…">Return for changes</ActionButton><ActionButton className="button button-primary" type="button" onClick={() => requestDecision("published")} disabled={isPending} isPending={isPending && decision === "published"} pendingLabel="Publishing…">Publish course</ActionButton></div>
    {decision && <ConfirmationDialog title={decision === "published" ? "Publish this course?" : "Return course for changes?"} description={<p>{decision === "published" ? "This course will become available as a published Growvelt course." : "This course will return to draft so the Instructor can make changes. Your internal review note will be recorded."}</p>} confirmLabel={decision === "published" ? "Publish course" : "Return for changes"} pendingLabel={decision === "published" ? "Publishing…" : "Returning…"} tone={decision === "returned" ? "danger" : "primary"} isPending={isPending} onCancel={() => !isPending && setDecision(null)} onConfirm={reviewCourse} />}
  </section>;
}
