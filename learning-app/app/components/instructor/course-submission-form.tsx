"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/app/components/ui/action-button";
import { ConfirmationDialog } from "@/app/components/ui/confirmation-dialog";
import { InlineFeedback } from "@/app/components/ui/inline-feedback";
import { createClient } from "@/app/lib/supabase/browser";

type RightsBasis = "original" | "licensed" | "authorized";

export function CourseSubmissionForm({ courseId }: { courseId: number }) {
  const router = useRouter();
  const [rightsBasis, setRightsBasis] = useState<RightsBasis>("original");
  const [accepted, setAccepted] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  function prepareSubmission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accepted) {
      setFeedback("Confirm that you have the rights to submit these course materials before continuing.");
      return;
    }
    setFeedback(null);
    setShowConfirmation(true);
  }

  async function submitForReview() {
    if (isPending) return;
    setIsPending(true);
    setFeedback(null);
    const { error } = await createClient().rpc("submit_learning_course_for_review", {
      p_course_id: courseId,
      p_declaration_version: "2026-08-v1",
      p_rights_basis: rightsBasis,
    });
    setIsPending(false);

    if (error) {
      setShowConfirmation(false);
      setFeedback("We couldn’t submit this course for review. Complete the course details and curriculum, then try again.");
      return;
    }

    setShowConfirmation(false);
    router.refresh();
  }

  return <section className="course-submission-panel" aria-labelledby="course-submission-title">
    <div>
      <p className="eyebrow">Ready for review</p>
      <h2 id="course-submission-title">Submit this course to Growvelt</h2>
      <p>Submission checks the course details and curriculum, then locks this draft while Growvelt reviews it. Only free courses can be submitted in this MVP because secure paid delivery is not available yet.</p>
    </div>
    <form onSubmit={prepareSubmission} className="course-submission-form">
      {feedback && <InlineFeedback variant="error">{feedback}</InlineFeedback>}
      <label className="course-field">Rights basis
        <select value={rightsBasis} onChange={(event) => setRightsBasis(event.target.value as RightsBasis)} disabled={isPending}>
          <option value="original">I created the course materials</option>
          <option value="licensed">I have a license to use the materials</option>
          <option value="authorized">I am otherwise authorized to use the materials</option>
        </select>
      </label>
      <label className="course-declaration">
        <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} disabled={isPending} />
        <span>I confirm that I own or have the necessary rights to use and publish the course materials I am submitting to Growvelt.</span>
      </label>
      <ActionButton className="button button-primary" type="submit" disabled={isPending} isPending={isPending} pendingLabel="Submitting for review…">Submit for review</ActionButton>
    </form>
    {showConfirmation && <ConfirmationDialog title="Submit course for review?" description={<p>This course will become read-only while Growvelt reviews it. It will not be published until a future review decision.</p>} confirmLabel="Submit for review" pendingLabel="Submitting for review…" isPending={isPending} onCancel={() => !isPending && setShowConfirmation(false)} onConfirm={submitForReview} />}
  </section>;
}
