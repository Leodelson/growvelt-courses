"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionButton } from "@/app/components/ui/action-button";
import { InlineFeedback } from "@/app/components/ui/inline-feedback";
import { useLanguage } from "@/app/components/language-provider";
import { createClient } from "@/app/lib/supabase/browser";

export function LessonCompleteButton({ courseId, lessonId, completed }: { courseId: number; lessonId: number; completed: boolean }) {
  const { locale } = useLanguage();
  const text = locale === "fr" ? { complete: "Leçon terminée", mark: "Marquer comme terminée", pending: "Validation…", error: "Nous n’avons pas pu marquer cette leçon comme terminée. Réessayez." } : locale === "es" ? { complete: "Lección completada", mark: "Marcar como completada", pending: "Marcando como completada…", error: "No pudimos marcar esta lección como completada. Inténtalo de nuevo." } : { complete: "Lesson complete", mark: "Mark complete", pending: "Marking complete…", error: "We couldn’t mark this lesson complete. Please try again." };
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [completedLocally, setCompletedLocally] = useState(completed);
  const [error, setError] = useState<string | null>(null);

  if (completed || completedLocally) return <p className="lesson-complete-state" role="status">{text.complete}</p>;

  async function complete() {
    if (pending) return;
    setPending(true);
    setError(null);
    const { error: rpcError } = await createClient().rpc("complete_own_enrolled_lesson", {
      p_course_id: courseId,
      p_lesson_id: lessonId,
    });
    setPending(false);
    if (rpcError) {
      setError(text.error);
      return;
    }
    setCompletedLocally(true);
    router.refresh();
  }

  return <div className="lesson-complete-action"><ActionButton type="button" className="button button-primary" onClick={complete} isPending={pending} pendingLabel={text.pending} disabled={pending}>{text.mark}</ActionButton>{error && <InlineFeedback variant="error">{error}</InlineFeedback>}</div>;
}
