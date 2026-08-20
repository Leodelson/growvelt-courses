"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/app/components/ui/action-button";
import { ConfirmationDialog } from "@/app/components/ui/confirmation-dialog";
import { InlineFeedback } from "@/app/components/ui/inline-feedback";
import { createClient } from "@/app/lib/supabase/browser";
import { useLanguage } from "@/app/components/language-provider";

type RightsBasis = "original" | "licensed" | "authorized";
type SubmissionFeedback = { variant: "error" | "success"; message: string } | null;

export function CourseSubmissionForm({ courseId }: { courseId: number }) {
  const router = useRouter();
  const { locale } = useLanguage();
  const text = locale === "fr" ? { accept: "Confirmez que vous avez les droits nécessaires sur ces supports avant de continuer.", ready: "Prêt pour l’examen", title: "Soumettre ce cours à Growvelt", copy: "La soumission vérifie les informations et le programme, puis verrouille le brouillon pendant l’examen par Growvelt.", rights: "Base des droits", original: "J’ai créé les supports du cours", licensed: "Je dispose d’une licence pour utiliser les supports", authorized: "Je suis autrement autorisé à utiliser les supports", declaration: "Je confirme posséder ou détenir les droits nécessaires pour utiliser et publier les supports soumis à Growvelt.", submit: "Soumettre à l’examen", pending: "Soumission…", confirm: "Soumettre le cours à l’examen ?", confirmCopy: "Ce cours sera en lecture seule pendant son examen par Growvelt.", quizError: "Ce cours ne peut pas encore être soumis. Complétez et enregistrez chaque question de quiz et ses choix de réponse.", error: "Nous n’avons pas pu soumettre ce cours. Complétez ses informations et son programme, puis réessayez.", success: "Cours soumis. Il attend maintenant l’examen de Growvelt." } : locale === "es" ? { accept: "Confirma que tienes los derechos necesarios sobre estos materiales antes de continuar.", ready: "Listo para revisión", title: "Enviar este curso a Growvelt", copy: "El envío comprueba los datos y el plan de estudios y bloquea el borrador mientras Growvelt lo revisa.", rights: "Base de derechos", original: "He creado los materiales del curso", licensed: "Tengo licencia para usar los materiales", authorized: "Tengo otra autorización para usar los materiales", declaration: "Confirmo que poseo o tengo los derechos necesarios para usar y publicar los materiales enviados a Growvelt.", submit: "Enviar a revisión", pending: "Enviando…", confirm: "¿Enviar el curso a revisión?", confirmCopy: "Este curso será de solo lectura mientras Growvelt lo revisa.", quizError: "Este curso aún no se puede enviar. Completa y guarda cada pregunta del cuestionario y sus opciones de respuesta.", error: "No pudimos enviar este curso. Completa sus datos y plan de estudios e inténtalo de nuevo.", success: "Curso enviado. Ahora espera la revisión de Growvelt." } : { accept: "Confirm that you have the rights to submit these course materials before continuing.", ready: "Ready for review", title: "Submit this course to Growvelt", copy: "Submission checks the course details and curriculum, then locks this draft while Growvelt reviews it.", rights: "Rights basis", original: "I created the course materials", licensed: "I have a license to use the materials", authorized: "I am otherwise authorized to use the materials", declaration: "I confirm that I own or have the necessary rights to use and publish the course materials I am submitting to Growvelt.", submit: "Submit for review", pending: "Submitting for review…", confirm: "Submit course for review?", confirmCopy: "This course will become read-only while Growvelt reviews it.", quizError: "This course cannot be submitted yet. Complete and save every quiz question and its answer options before submitting for review.", error: "We couldn’t submit this course for review. Complete the course details and curriculum, then try again.", success: "Course submitted successfully. It is now awaiting Growvelt review." };
  const [rightsBasis, setRightsBasis] = useState<RightsBasis>("original");
  const [accepted, setAccepted] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [feedback, setFeedback] = useState<SubmissionFeedback>(null);

  function prepareSubmission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accepted) {
      setFeedback({ variant: "error", message: text.accept });
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
      if (error.message.includes("Quiz assessment is incomplete")) {
        setShowConfirmation(false);
        setFeedback({ variant: "error", message: text.quizError });
        return;
      }
      setShowConfirmation(false);
      setFeedback({ variant: "error", message: text.error });
      return;
    }

    setShowConfirmation(false);
    setFeedback({ variant: "success", message: text.success });
    router.refresh();
  }

  return <section className="course-submission-panel" aria-labelledby="course-submission-title">
    <div>
      <p className="eyebrow">{text.ready}</p><h2 id="course-submission-title">{text.title}</h2><p>{text.copy}</p>
    </div>
    <form onSubmit={prepareSubmission} className="course-submission-form">
      {feedback && <InlineFeedback variant={feedback.variant}>{feedback.message}</InlineFeedback>}
      <label className="course-field">{text.rights}
        <select value={rightsBasis} onChange={(event) => setRightsBasis(event.target.value as RightsBasis)} disabled={isPending}>
          <option value="original">{text.original}</option><option value="licensed">{text.licensed}</option><option value="authorized">{text.authorized}</option>
        </select>
      </label>
      <label className="course-declaration">
        <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} disabled={isPending} />
        <span>{text.declaration}</span>
      </label>
      <ActionButton className="button button-primary" type="submit" disabled={isPending} isPending={isPending} pendingLabel={text.pending}>{text.submit}</ActionButton>
    </form>
    {showConfirmation && <ConfirmationDialog title={text.confirm} description={<p>{text.confirmCopy}</p>} confirmLabel={text.submit} pendingLabel={text.pending} isPending={isPending} onCancel={() => !isPending && setShowConfirmation(false)} onConfirm={submitForReview} />}
  </section>;
}
