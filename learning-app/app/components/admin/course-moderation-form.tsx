"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/app/components/ui/action-button";
import { ConfirmationDialog } from "@/app/components/ui/confirmation-dialog";
import { InlineFeedback } from "@/app/components/ui/inline-feedback";
import { createClient } from "@/app/lib/supabase/browser";
import { useLanguage } from "@/app/components/language-provider";

type Decision = "published" | "returned";

export function CourseModerationForm({ courseId }: { courseId: number }) {
  const router = useRouter();
  const { locale } = useLanguage();
  const text = locale === "fr" ? { noteRequired: "Expliquez les changements nécessaires avant de renvoyer ce cours.", error: "Le cours n’a pas pu être examiné. Actualisez la page et vérifiez son statut.", eyebrow: "Décision d’examen", title: "Publier ou renvoyer", copy: "Les notes de retour sont internes à Growvelt. L’instructeur reçoit un statut générique de retour pour modifications.", note: "Note d’examen", noteHelp: "Obligatoire lors d’un retour ; facultative lors d’une publication.", returning: "Retour…", return: "Renvoyer pour modifications", publishing: "Publication…", publish: "Publier le cours", publishTitle: "Publier ce cours ?", returnTitle: "Renvoyer le cours pour modifications ?", publishCopy: "Ce cours deviendra disponible comme cours Growvelt publié.", returnCopy: "Ce cours redeviendra un brouillon afin que l’instructeur puisse le modifier. Votre note interne sera enregistrée." } : locale === "es" ? { noteRequired: "Explica qué debe cambiar antes de devolver este curso.", error: "No se pudo revisar el curso. Actualiza la página y confirma su estado.", eyebrow: "Decisión de revisión", title: "Publicar o devolver", copy: "Las notas de devolución son internas de Growvelt. El instructor recibe un estado genérico de devolución para cambios.", note: "Nota de revisión", noteHelp: "Obligatoria al devolver; opcional al publicar.", returning: "Devolviendo…", return: "Devolver para cambios", publishing: "Publicando…", publish: "Publicar curso", publishTitle: "¿Publicar este curso?", returnTitle: "¿Devolver el curso para cambios?", publishCopy: "Este curso estará disponible como curso publicado de Growvelt.", returnCopy: "Este curso volverá a borrador para que el instructor pueda hacer cambios. Se registrará tu nota interna." } : { noteRequired: "Explain what needs to change before returning this course.", error: "The course could not be reviewed. Refresh the page and confirm its current status.", eyebrow: "Review decision", title: "Publish or return", copy: "Return notes are internal to Growvelt in this phase. The Instructor receives a safe generic returned-for-changes status.", note: "Review note", noteHelp: "Required when returning for changes; optional when publishing.", returning: "Returning…", return: "Return for changes", publishing: "Publishing…", publish: "Publish course", publishTitle: "Publish this course?", returnTitle: "Return course for changes?", publishCopy: "This course will become available as a published Growvelt course.", returnCopy: "This course will return to draft so the Instructor can make changes. Your internal review note will be recorded." };
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function requestDecision(nextDecision: Decision) {
    if (isPending) return;
    if (nextDecision === "returned" && note.trim().length < 2) {
      setMessage(text.noteRequired);
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
      setMessage(text.error);
      return;
    }
    router.push("/dashboard/admin/courses");
    router.refresh();
  }

  return <section className="admin-review-panel" aria-labelledby="course-review-title">
    <div><p className="eyebrow">{text.eyebrow}</p><h2 id="course-review-title">{text.title}</h2><p>{text.copy}</p></div>
    <label className="admin-field">{text.note} <span>{text.noteHelp}</span><textarea value={note} maxLength={2000} rows={5} onChange={(event) => setNote(event.target.value)} disabled={isPending} /></label>
    {message && <InlineFeedback variant="error">{message}</InlineFeedback>}
    <div className="admin-review-actions"><ActionButton className="button button-secondary" type="button" onClick={() => requestDecision("returned")} disabled={isPending} isPending={isPending && decision === "returned"} pendingLabel={text.returning}>{text.return}</ActionButton><ActionButton className="button button-primary" type="button" onClick={() => requestDecision("published")} disabled={isPending} isPending={isPending && decision === "published"} pendingLabel={text.publishing}>{text.publish}</ActionButton></div>
    {decision && <ConfirmationDialog title={decision === "published" ? text.publishTitle : text.returnTitle} description={<p>{decision === "published" ? text.publishCopy : text.returnCopy}</p>} confirmLabel={decision === "published" ? text.publish : text.return} pendingLabel={decision === "published" ? text.publishing : text.returning} tone={decision === "returned" ? "danger" : "primary"} isPending={isPending} onCancel={() => !isPending && setDecision(null)} onConfirm={reviewCourse} />}
  </section>;
}
