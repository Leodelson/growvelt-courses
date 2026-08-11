"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionButton } from "@/app/components/ui/action-button";
import { InlineFeedback } from "@/app/components/ui/inline-feedback";
import { createClient } from "@/app/lib/supabase/browser";

export function LessonCompleteButton({ courseId, lessonId, completed }: { courseId: number; lessonId: number; completed: boolean }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  if (completed) return <p className="lesson-complete-state" role="status">Lesson complete</p>;
  async function complete() { if (pending) return; setPending(true); setError(null); const { error: rpcError } = await createClient().rpc("complete_own_enrolled_lesson", { p_course_id: courseId, p_lesson_id: lessonId }); setPending(false); if (rpcError) { setError("We couldn’t mark this lesson complete. Please try again."); return; } router.refresh(); }
  return <div className="lesson-complete-action"><ActionButton type="button" className="button button-primary" onClick={complete} isPending={pending} pendingLabel="Marking complete…" disabled={pending}>Mark complete</ActionButton>{error && <InlineFeedback variant="error">{error}</InlineFeedback>}</div>;
}
