"use client";

import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { ActionButton } from "@/app/components/ui/action-button";
import { InlineFeedback } from "@/app/components/ui/inline-feedback";
import { createClient } from "@/app/lib/supabase/browser";
import { useLanguage } from "@/app/components/language-provider";

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
  const { locale } = useLanguage();
  const text = locale === "fr" ? { error: "La candidature n’a pas pu être examinée. Actualisez la page et réessayez.", decision: "Décision d’examen", title: "Approuver ou rejeter", copy: "Cette note interne concerne la décision actuelle et n’est pas montrée au candidat.", note: "Note d’examen interne", optional: "(facultative)", rejecting: "Rejet…", reject: "Rejeter la candidature", approving: "Approbation…", approve: "Approuver l’instructeur", confirm: "Confirmer la décision", approveTitle: "Approuver la candidature instructeur ?", rejectTitle: "Rejeter la candidature instructeur ?", approveCopy: "L’approbation accorde à cette personne l’accès instructeur à Growvelt Learning.", rejectCopy: "Le rejet laisse cette personne comme apprenant, sans accès instructeur.", cancel: "Annuler" } : locale === "es" ? { error: "No se pudo revisar la solicitud. Actualiza la página e inténtalo de nuevo.", decision: "Decisión de revisión", title: "Aprobar o rechazar", copy: "Esta nota interna corresponde a la decisión actual y no se muestra al solicitante.", note: "Nota interna de revisión", optional: "(opcional)", rejecting: "Rechazando…", reject: "Rechazar solicitud", approving: "Aprobando…", approve: "Aprobar instructor", confirm: "Confirmar decisión", approveTitle: "¿Aprobar la solicitud de instructor?", rejectTitle: "¿Rechazar la solicitud de instructor?", approveCopy: "La aprobación concede a esta persona acceso de instructor a Growvelt Learning.", rejectCopy: "El rechazo mantiene a esta persona como estudiante, sin acceso de instructor.", cancel: "Cancelar" } : { error: "The application could not be reviewed. Refresh the page and try again.", decision: "Review decision", title: "Approve or reject", copy: "This is an internal note for the current decision. It is not shown to the applicant.", note: "Internal review note", optional: "(optional)", rejecting: "Rejecting…", reject: "Reject application", approving: "Approving…", approve: "Approve Instructor", confirm: "Confirm decision", approveTitle: "Approve Instructor application?", rejectTitle: "Reject Instructor application?", approveCopy: "Approving grants this person Instructor access to Growvelt Learning.", rejectCopy: "Rejecting leaves this person as a Learner. They will not receive Instructor access.", cancel: "Cancel" };
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [confirmation, setConfirmation] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pendingRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirmation) cancelRef.current?.focus();
  }, [confirmation]);

  function requestDecision(nextDecision: Decision, trigger: HTMLButtonElement) {
    if (busy) return;
    triggerRef.current = trigger;
    setMessage("");
    setConfirmation(nextDecision);
  }

  function closeConfirmation() {
    if (busy) return;
    setConfirmation(null);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeConfirmation();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), textarea:not([disabled])");
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function review() {
    if (!confirmation || pendingRef.current) return;
    const nextDecision = confirmation;
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
      setMessage(locale === "en" ? reviewFailureMessage(error) : text.error);
      setBusy(false);
      setDecision(null);
      setConfirmation(null);
      pendingRef.current = false;
      window.setTimeout(() => triggerRef.current?.focus(), 0);
    }
  }

  const isApproval = confirmation === "approved";
  return <section className="admin-review-panel" aria-labelledby="review-title">
    <div><p className="eyebrow">{text.decision}</p><h2 id="review-title">{text.title}</h2><p>{text.copy}</p></div>
    <label className="admin-field">{text.note} <span>{text.optional}</span><textarea value={note} maxLength={2000} rows={5} onChange={(event) => setNote(event.target.value)} disabled={busy} /></label>
    {message && <InlineFeedback variant="error">{message}</InlineFeedback>}
    <div className="admin-review-actions"><ActionButton className="button button-secondary" type="button" onClick={(event) => requestDecision("rejected", event.currentTarget)} isPending={busy && decision === "rejected"} pendingLabel={text.rejecting} disabled={busy} aria-haspopup="dialog" aria-expanded={confirmation === "rejected"}>{text.reject}</ActionButton><ActionButton className="button button-primary" type="button" onClick={(event) => requestDecision("approved", event.currentTarget)} isPending={busy && decision === "approved"} pendingLabel={text.approving} disabled={busy} aria-haspopup="dialog" aria-expanded={confirmation === "approved"}>{text.approve}</ActionButton></div>
    {confirmation && <div className="review-dialog-backdrop" role="presentation"><div className="review-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="review-confirmation-title" aria-describedby="review-confirmation-description" onKeyDown={handleDialogKeyDown}><p className="eyebrow">{text.confirm}</p><h3 id="review-confirmation-title">{isApproval ? text.approveTitle : text.rejectTitle}</h3><p id="review-confirmation-description">{isApproval ? text.approveCopy : text.rejectCopy}</p><div className="review-dialog-actions"><button ref={cancelRef} className="button button-secondary" type="button" onClick={closeConfirmation} disabled={busy}>{text.cancel}</button><ActionButton className={`button ${isApproval ? "button-primary" : "button-danger"}`} type="button" onClick={review} isPending={busy} pendingLabel={isApproval ? text.approving : text.rejecting}>{isApproval ? text.approve : text.reject}</ActionButton></div></div></div>}
  </section>;
}
