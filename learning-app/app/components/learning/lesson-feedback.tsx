"use client";

import { useState } from "react";
import { Flag, LoaderCircle, ThumbsDown, ThumbsUp } from "lucide-react";
import { useLanguage } from "@/app/components/language-provider";
import { createClient } from "@/app/lib/supabase/browser";
import styles from "./lesson-feedback.module.css";

const translations = {
  en: {
    title: "Was this lesson helpful?", yes: "Yes, it helped", no: "Not really", report: "Report an issue", closeReport: "Close report form",
    reportTitle: "Tell Growvelt what needs attention", reportCopy: "Your report goes to Growvelt administrators for review. The instructor is not notified automatically.",
    reasons: ["Video will not play or keeps buffering", "Poor video or audio quality", "Captions or transcript need attention", "The lesson is unclear or hard to follow", "The content may be inaccurate or outdated", "Something else"],
    details: "Add details (optional)", placeholder: "Share enough detail to help us review this lesson.", otherRequired: "Please briefly explain the issue you selected.", submit: "Submit report", cancel: "Cancel", sending: "Submitting…", thanks: "Thanks. Your feedback was saved.", reportThanks: "Thanks. Your report was sent to Growvelt for review.", voteError: "We could not save your feedback. Please try again.", reportError: "We could not submit your report. Please try again.", chooseReason: "Choose at least one reason.",
  },
  fr: {
    title: "Cette leçon vous a-t-elle aidé ?", yes: "Oui, beaucoup", no: "Pas vraiment", report: "Signaler un problème", closeReport: "Fermer le formulaire", reportTitle: "Indiquez à Growvelt ce qui doit être examiné", reportCopy: "Votre signalement est envoyé aux administrateurs Growvelt. Le formateur n’est pas averti automatiquement.",
    reasons: ["La vidéo ne démarre pas ou se bloque", "Qualité vidéo ou audio médiocre", "Problème de sous-titres ou de transcription", "La leçon est difficile à suivre", "Le contenu semble inexact ou obsolète", "Autre chose"], details: "Ajouter des détails (facultatif)", placeholder: "Ajoutez des détails utiles à l’examen de cette leçon.", otherRequired: "Veuillez expliquer brièvement le problème sélectionné.", submit: "Envoyer le signalement", cancel: "Annuler", sending: "Envoi…", thanks: "Merci. Votre avis a été enregistré.", reportThanks: "Merci. Votre signalement a été envoyé à Growvelt.", voteError: "Impossible d’enregistrer votre avis. Réessayez.", reportError: "Impossible d’envoyer le signalement. Réessayez.", chooseReason: "Choisissez au moins un motif.",
  },
  es: {
    title: "¿Te resultó útil esta lección?", yes: "Sí, me ayudó", no: "No mucho", report: "Informar de un problema", closeReport: "Cerrar formulario", reportTitle: "Cuéntale a Growvelt qué debemos revisar", reportCopy: "El informe se envía a los administradores de Growvelt. No se avisa automáticamente al instructor.",
    reasons: ["El vídeo no se reproduce o se detiene", "Mala calidad de vídeo o audio", "Problema con subtítulos o transcripción", "La lección no es clara o cuesta seguirla", "El contenido puede ser inexacto o antiguo", "Otra cosa"], details: "Añade detalles (opcional)", placeholder: "Incluye detalles que nos ayuden a revisar la lección.", otherRequired: "Explica brevemente el problema seleccionado.", submit: "Enviar informe", cancel: "Cancelar", sending: "Enviando…", thanks: "Gracias. Guardamos tus comentarios.", reportThanks: "Gracias. Enviamos tu informe a Growvelt para su revisión.", voteError: "No se pudieron guardar tus comentarios. Inténtalo de nuevo.", reportError: "No se pudo enviar el informe. Inténtalo de nuevo.", chooseReason: "Elige al menos un motivo.",
  },
} as const;

const reasonKeys = ["playback", "quality", "captions", "clarity", "accuracy", "other"] as const;

export function LessonFeedback({ lessonId, courseSlug, initialReaction }: { lessonId: number; courseSlug: string; initialReaction: number | null }) {
  const { locale } = useLanguage();
  const text = translations[locale];
  const [reaction, setReaction] = useState(initialReaction);
  const [pending, setPending] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function react(nextReaction: 1 | -1) {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const { data, error: rpcError } = await createClient().rpc("toggle_own_learning_lesson_reaction", {
        p_lesson_id: lessonId,
        p_reaction: nextReaction,
      });
      if (rpcError || (data !== null && data !== 1 && data !== -1)) throw new Error("Reaction update failed");
      setReaction(data);
      setMessage(text.thanks);
    } catch {
      setError(text.voteError);
    } finally {
      setPending(false);
    }
  }

  function toggleReason(reason: string) {
    setReasons((current) => current.includes(reason) ? current.filter((item) => item !== reason) : [...current, reason]);
  }

  async function submitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!reasons.length) { setError(text.chooseReason); return; }
    if (reasons.includes("other") && details.trim().length < 10) { setError(text.otherRequired); return; }
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/learning/lesson-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseSlug, lessonId, reasons, details }),
      });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error || text.reportError);
      setMessage(text.reportThanks);
      setShowReport(false);
      setReasons([]);
      setDetails("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : text.reportError);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={styles.feedback} aria-labelledby="lesson-feedback-title">
      <div className={styles.feedbackHeading}>
        <h2 id="lesson-feedback-title">{text.title}</h2>
        <div className={styles.actions}>
          <button type="button" className={`${styles.action} ${reaction === 1 ? styles.selected : ""}`} onClick={() => react(1)} disabled={pending} aria-pressed={reaction === 1}>
            <ThumbsUp size={17} aria-hidden="true" /><span>{text.yes}</span>
          </button>
          <button type="button" className={`${styles.action} ${reaction === -1 ? styles.selected : ""}`} onClick={() => react(-1)} disabled={pending} aria-pressed={reaction === -1}>
            <ThumbsDown size={17} aria-hidden="true" /><span>{text.no}</span>
          </button>
          <button type="button" className={`${styles.action} ${styles.reportToggle}`} onClick={() => { setShowReport((current) => !current); setError(""); }} aria-expanded={showReport} aria-controls="lesson-report-form" disabled={pending}>
            <Flag size={16} aria-hidden="true" /><span>{showReport ? text.closeReport : text.report}</span>
          </button>
        </div>
      </div>

      {message ? <p className={styles.status} role="status">{message}</p> : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}

      {showReport ? (
        <form id="lesson-report-form" className={styles.reportForm} onSubmit={submitReport}>
          <div><h3>{text.reportTitle}</h3><p>{text.reportCopy}</p></div>
          <fieldset className={styles.reasonList} disabled={pending}>
            <legend className="sr-only">{text.reportTitle}</legend>
            {reasonKeys.map((reason, index) => (
              <label key={reason} className={styles.reason}>
                <input type="checkbox" value={reason} checked={reasons.includes(reason)} onChange={() => toggleReason(reason)} />
                <span>{text.reasons[index]}</span>
              </label>
            ))}
          </fieldset>
          <label className={styles.detailsLabel}>
            <span>{text.details}</span>
            <textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={1500} placeholder={text.placeholder} rows={4} disabled={pending} />
          </label>
          <div className={styles.formActions}>
            <button className="button button-primary" type="submit" disabled={pending}>{pending ? <><LoaderCircle size={16} className={styles.spinner} aria-hidden="true" />{text.sending}</> : text.submit}</button>
            <button className="button button-secondary" type="button" onClick={() => { setShowReport(false); setError(""); }} disabled={pending}>{text.cancel}</button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
