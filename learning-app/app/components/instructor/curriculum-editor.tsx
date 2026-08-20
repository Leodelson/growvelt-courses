"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/app/components/ui/action-button";
import { ConfirmationDialog } from "@/app/components/ui/confirmation-dialog";
import { InlineFeedback } from "@/app/components/ui/inline-feedback";
import type { CurriculumLesson, CurriculumModule } from "@/app/lib/instructor/curriculum";
import type { CourseStatus } from "@/app/lib/instructor/course-options";
import { createClient } from "@/app/lib/supabase/browser";
import { useLanguage } from "@/app/components/language-provider";

type Feedback = { variant: "error" | "success" | "info"; message: string } | null;
type ConfirmTarget = { kind: "module" | "lesson"; id: number; title: string; lessonCount?: number } | null;

function youtubeReference(value: string) {
  const candidate = value.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(candidate)) return candidate;
  try {
    const url = new URL(candidate);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    let id = "";
    if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    if (host === "youtube.com" || host === "m.youtube.com") {
      id = url.searchParams.get("v") ?? "";
      if (!id) {
        const [first, second] = url.pathname.split("/").filter(Boolean);
        if (["embed", "shorts", "live"].includes(first)) id = second ?? "";
      }
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "Duration not set";
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

export function CurriculumEditor({ courseId, status, initialModules }: { courseId: number; status: CourseStatus; initialModules: CurriculumModule[] }) {
  const router = useRouter();
  const { locale } = useLanguage();
  const text = locale === "fr" ? { mutation: "Nous n’avons pas pu enregistrer cette modification. Vérifiez les informations et réessayez.", moduleTitle: "Saisissez un titre de module d’au moins deux caractères.", moduleAdded: "Module ajouté à ce brouillon.", moduleSaved: "Titre du module enregistré.", lessonTitle: "Saisissez un titre de leçon d’au moins deux caractères.", videoRequired: "Saisissez une URL ou un identifiant YouTube pris en charge et une durée en minutes.", textRequired: "Saisissez le contenu de la leçon texte.", lessonSaved: "Leçon enregistrée.", lessonAdded: "Leçon ajoutée à ce module.", moduleDeleted: "Module et leçons supprimés.", lessonDeleted: "Leçon supprimée.", readonly: "Le programme est en lecture seule tant que ce cours n’est pas revenu au statut de brouillon.", structure: "Structure du cours", curriculum: "Programme", intro: "Créez des modules ciblés avec des activités texte, vidéo et quiz.", newModule: "Titre du nouveau module", modulePlaceholder: "Titre du module", adding: "Ajout…", addModule: "Ajouter un module", start: "Commencez ici", first: "Construisez la première section de ce cours.", firstCopy: "Un module regroupe des leçons connexes. Vous pouvez le modifier tant que le cours est un brouillon.", save: "Enregistrer", saving: "Enregistrement…", moveUp: "Monter", moveDown: "Descendre", delete: "Supprimer", deleteModule: "Supprimer ce module ?", deleteLesson: "Supprimer cette leçon ?", confirmModule: "Supprimer le module", confirmLesson: "Supprimer la leçon", deleting: "Suppression…" } : locale === "es" ? { mutation: "No pudimos guardar este cambio. Revisa los datos e inténtalo de nuevo.", moduleTitle: "Introduce un título de módulo de al menos dos caracteres.", moduleAdded: "Módulo añadido a este borrador.", moduleSaved: "Título del módulo guardado.", lessonTitle: "Introduce un título de lección de al menos dos caracteres.", videoRequired: "Introduce una URL o un ID de YouTube compatible y una duración en minutos.", textRequired: "Introduce el contenido de la lección de texto.", lessonSaved: "Lección guardada.", lessonAdded: "Lección añadida a este módulo.", moduleDeleted: "Módulo y lecciones eliminados.", lessonDeleted: "Lección eliminada.", readonly: "El plan de estudios será de solo lectura hasta que el curso vuelva a borrador.", structure: "Estructura del curso", curriculum: "Plan de estudios", intro: "Crea módulos enfocados con actividades de texto, vídeo y cuestionario.", newModule: "Título del nuevo módulo", modulePlaceholder: "Título del módulo", adding: "Añadiendo…", addModule: "Añadir módulo", start: "Empieza aquí", first: "Crea la primera sección de este curso.", firstCopy: "Un módulo agrupa lecciones relacionadas. Puedes modificarlo mientras el curso sea un borrador.", save: "Guardar", saving: "Guardando…", moveUp: "Subir", moveDown: "Bajar", delete: "Eliminar", deleteModule: "¿Eliminar este módulo?", deleteLesson: "¿Eliminar esta lección?", confirmModule: "Eliminar módulo", confirmLesson: "Eliminar lección", deleting: "Eliminando…" } : { mutation: "We couldn’t save that curriculum change. Review the details and try again.", moduleTitle: "Enter a module title with at least two characters.", moduleAdded: "Module added to this draft.", moduleSaved: "Module title saved.", lessonTitle: "Enter a lesson title with at least two characters.", videoRequired: "Enter a supported YouTube URL or video ID and a duration in minutes.", textRequired: "Enter the text lesson content.", lessonSaved: "Lesson saved.", lessonAdded: "Lesson added to this module.", moduleDeleted: "Module and its lessons deleted.", lessonDeleted: "Lesson deleted.", readonly: "Curriculum is read-only until this course returns to draft status.", structure: "Course structure", curriculum: "Curriculum", intro: "Create focused modules with text, video, and quiz activities.", newModule: "New module title", modulePlaceholder: "Module title", adding: "Adding…", addModule: "Add module", start: "Start here", first: "Build the first section of this course.", firstCopy: "A module groups related lessons. You can change it while this course is a draft.", save: "Save", saving: "Saving…", moveUp: "Move up", moveDown: "Move down", delete: "Delete", deleteModule: "Delete this module?", deleteLesson: "Delete this lesson?", confirmModule: "Delete module", confirmLesson: "Delete lesson", deleting: "Deleting…" };
  const modules = initialModules;
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmTarget>(null);
  const editable = status === "draft";

  async function call(name: string, args: Record<string, unknown>, key: string) {
    if (pendingKey || !editable) return false;
    setPendingKey(key); setFeedback(null);
    const { error } = await createClient().rpc(name, args);
    setPendingKey(null);
    if (error) { setFeedback({ variant: "error", message: text.mutation }); return false; }
    router.refresh();
    return true;
  }

  async function addModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const title = String(new FormData(formElement).get("module-title") ?? "").trim();
    if (title.length < 2) { setFeedback({ variant: "error", message: text.moduleTitle }); return; }
    if (await call("add_instructor_course_module", { p_course_id: courseId, p_title: title }, "add-module")) { formElement.reset(); setFeedback({ variant: "success", message: text.moduleAdded }); }
  }

  async function updateModule(moduleId: number, event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const title = String(new FormData(event.currentTarget).get("title") ?? "").trim();
    if (title.length < 2) { setFeedback({ variant: "error", message: text.moduleTitle }); return; }
    if (await call("update_instructor_course_module", { p_module_id: moduleId, p_title: title }, `module-${moduleId}`)) setFeedback({ variant: "success", message: text.moduleSaved });
  }

  async function saveLesson(moduleId: number, lesson: CurriculumLesson | null, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const title = String(form.get("title") ?? "").trim(); const type = String(form.get("lesson-type") ?? "text");
    const content = String(form.get("content") ?? "").trim(); const reference = youtubeReference(String(form.get("youtube-url") ?? ""));
    const minutes = Number(form.get("duration-minutes")); const duration = Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : null;
    if (title.length < 2) { setFeedback({ variant: "error", message: text.lessonTitle }); return; }
    if (type === "video" && (!reference || !duration)) { setFeedback({ variant: "error", message: text.videoRequired }); return; }
    if (type === "text" && !content) { setFeedback({ variant: "error", message: text.textRequired }); return; }
    const args = { p_course_id: courseId, p_module_id: moduleId, p_title: title, p_lesson_type: type, p_content: content || null, p_video_provider: type === "video" ? "youtube" : null, p_video_reference: type === "video" ? reference : null, p_video_visibility: type === "video" ? String(form.get("video-visibility") ?? "public") : null, p_duration_seconds: type === "video" ? duration : null, p_is_preview: form.get("is-preview") === "on" };
    const name = lesson ? "update_instructor_course_lesson" : "add_instructor_course_lesson";
    const payload = lesson ? { p_lesson_id: lesson.id, p_module_id: moduleId, p_title: title, p_lesson_type: type, p_content: content || null, p_video_provider: type === "video" ? "youtube" : null, p_video_reference: type === "video" ? reference : null, p_video_visibility: type === "video" ? String(form.get("video-visibility") ?? "public") : null, p_duration_seconds: type === "video" ? duration : null, p_is_preview: form.get("is-preview") === "on" } : args;
    if (await call(name, payload, lesson ? `lesson-${lesson.id}` : `add-lesson-${moduleId}`)) { if (!lesson) formElement.reset(); setFeedback({ variant: "success", message: lesson ? text.lessonSaved : text.lessonAdded }); }
  }

  async function confirmDelete() {
    if (!confirm) return;
    const target = confirm;
    if (await call(target.kind === "module" ? "delete_instructor_course_module" : "delete_instructor_course_lesson", target.kind === "module" ? { p_module_id: target.id } : { p_lesson_id: target.id }, `delete-${target.kind}-${target.id}`)) { setConfirm(null); setFeedback({ variant: "success", message: target.kind === "module" ? text.moduleDeleted : text.lessonDeleted }); }
  }

  return <div className="curriculum-editor">
    {!editable && <InlineFeedback variant="info">{text.readonly}</InlineFeedback>}
    {feedback && <InlineFeedback variant={feedback.variant}>{feedback.message}</InlineFeedback>}
    <section className="curriculum-toolbar" aria-labelledby="curriculum-title"><div><p className="eyebrow">{text.structure}</p><h1 id="curriculum-title">{text.curriculum}</h1><p>{text.intro}</p></div><form onSubmit={addModule} className="add-module-form"><label className="sr-only" htmlFor="module-title">{text.newModule}</label><input id="module-title" name="module-title" placeholder={text.modulePlaceholder} maxLength={160} disabled={!editable || Boolean(pendingKey)} /><ActionButton className="button button-primary" type="submit" isPending={pendingKey === "add-module"} pendingLabel={text.adding} disabled={!editable}>{text.addModule}</ActionButton></form></section>
    {modules.length === 0 ? <section className="curriculum-empty"><p className="eyebrow">{text.start}</p><h2>{text.first}</h2><p>{text.firstCopy}</p></section> : <ol className="curriculum-modules">{modules.map((module, index) => <li key={module.id} className="curriculum-module"><div className="module-heading"><span className="module-order">{String(index + 1).padStart(2, "0")}</span><form onSubmit={(event) => updateModule(module.id, event)} className="module-title-form"><label className="sr-only" htmlFor={`module-${module.id}`}>{text.modulePlaceholder}</label><input id={`module-${module.id}`} name="title" defaultValue={module.title} maxLength={160} disabled={!editable || Boolean(pendingKey)} /><ActionButton className="button button-small" type="submit" isPending={pendingKey === `module-${module.id}`} pendingLabel={text.saving} disabled={!editable}>{text.save}</ActionButton></form><div className="row-actions"><button type="button" className="text-button" onClick={() => call("move_instructor_course_module", { p_module_id: module.id, p_direction: "up" }, `module-move-${module.id}`)} disabled={!editable || Boolean(pendingKey) || index === 0}>{text.moveUp}</button><button type="button" className="text-button" onClick={() => call("move_instructor_course_module", { p_module_id: module.id, p_direction: "down" }, `module-move-${module.id}`)} disabled={!editable || Boolean(pendingKey) || index === modules.length - 1}>{text.moveDown}</button><button type="button" className="text-button text-button-danger" onClick={() => setConfirm({ kind: "module", id: module.id, title: module.title, lessonCount: module.lessons.length })} disabled={!editable || Boolean(pendingKey)}>{text.delete}</button></div></div>
      <div className="lesson-list">{module.lessons.map((lesson, lessonIndex) => <div key={lesson.id}><LessonEditor courseId={courseId} moduleId={module.id} lesson={lesson} editable={editable} pendingKey={pendingKey} onSave={saveLesson} onMove={(direction) => call("move_instructor_course_lesson", { p_lesson_id: lesson.id, p_direction: direction }, `lesson-move-${lesson.id}`)} onDelete={() => setConfirm({ kind: "lesson", id: lesson.id, title: lesson.title })} isFirst={lessonIndex === 0} isLast={lessonIndex === module.lessons.length - 1} />{lesson.type === "quiz" && <QuizBuilder lessonId={lesson.id} editable={editable} />}</div>)}</div>
      {editable && <LessonEditor courseId={courseId} moduleId={module.id} lesson={null} editable={editable} pendingKey={pendingKey} onSave={saveLesson} onMove={() => undefined} onDelete={() => undefined} isFirst={false} isLast={false} />}</li>)}</ol>}
    {confirm && <ConfirmationDialog title={confirm.kind === "module" ? text.deleteModule : text.deleteLesson} description={<p>{confirm.title}</p>} confirmLabel={confirm.kind === "module" ? text.confirmModule : text.confirmLesson} pendingLabel={text.deleting} tone="danger" isPending={pendingKey === `delete-${confirm.kind}-${confirm.id}`} onCancel={() => !pendingKey && setConfirm(null)} onConfirm={confirmDelete} />}
  </div>;
}

type QuizAuthorRow = { quiz_id: number; instructions: string | null; passing_percentage: number; question_id: number | null; question_text: string | null; question_position: number | null; option_id: number | null; option_text: string | null; option_position: number | null; is_correct: boolean | null };

type QuizQuestionEditorProps = {
  label: string;
  initialQuestion?: string;
  initialOptions?: string[];
  initialCorrect?: number;
  editable: boolean;
  pending: boolean;
  submitLabel: string;
  pendingLabel: string;
  onSave: (question: string, options: string[], correctOption: number) => Promise<boolean>;
  actions?: ReactNode;
  isNew?: boolean;
};

function QuizQuestionEditor({ label, initialQuestion = "", initialOptions = ["", ""], initialCorrect = 0, editable, pending, submitLabel, pendingLabel, onSave, actions, isNew = false }: QuizQuestionEditorProps) {
  const { locale } = useLanguage();
  const copy = locale === "fr" ? { unsaved: "Modifications non enregistrées", new: "Pas encore enregistré", saved: "Enregistré", question: "Question", answers: "Choix de réponse", option: "Choix", remove: "Retirer", add: "+ Ajouter un choix", hint: "sur 6 choix · Sélectionnez une bonne réponse" } : locale === "es" ? { unsaved: "Cambios sin guardar", new: "Aún no guardado", saved: "Guardado", question: "Pregunta", answers: "Opciones de respuesta", option: "Opción", remove: "Quitar", add: "+ Añadir opción", hint: "de 6 opciones · Selecciona una respuesta correcta" } : { unsaved: "Unsaved changes", new: "Not saved yet", saved: "Saved", question: "Question", answers: "Answer options", option: "Option", remove: "Remove", add: "+ Add option", hint: "of 6 options · Select one correct answer" };
  const [question, setQuestion] = useState(initialQuestion);
  const [options, setOptions] = useState(initialOptions.length >= 2 ? initialOptions : ["", ""]);
  const [correctOption, setCorrectOption] = useState(initialCorrect >= 0 && initialCorrect < initialOptions.length ? initialCorrect : 0);
  const [dirty, setDirty] = useState(false);

  function updateOption(index: number, value: string) {
    setOptions((current) => current.map((option, optionIndex) => optionIndex === index ? value : option));
    setDirty(true);
  }

  function addOption() {
    if (options.length >= 6) return;
    setOptions((current) => [...current, ""]);
    setDirty(true);
  }

  function removeOption(index: number) {
    if (options.length <= 2) return;
    setOptions((current) => current.filter((_, optionIndex) => optionIndex !== index));
    setCorrectOption((current) => current === index ? 0 : current > index ? current - 1 : current);
    setDirty(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await onSave(question.trim(), options.map((option) => option.trim()), correctOption);
    if (saved) setDirty(false);
  }

  return <form onSubmit={submit} className="quiz-question-editor">
    <div className="quiz-question-heading"><strong>{label}</strong><span className={dirty || isNew ? "quiz-save-state is-unsaved" : "quiz-save-state"}>{dirty ? copy.unsaved : isNew ? copy.new : copy.saved}</span></div>
    <label className="course-field">{copy.question}<textarea value={question} onChange={(event) => { setQuestion(event.target.value); setDirty(true); }} rows={2} required disabled={!editable || pending} /></label>
    <fieldset className="quiz-option-editor" disabled={!editable || pending}><legend>{copy.answers}</legend>{options.map((option, index) => <div className="quiz-author-option" key={index}><label className="quiz-option"><input type="radio" name="correct-option" value={index} checked={correctOption === index} onChange={() => { setCorrectOption(index); setDirty(true); }} /><input value={option} onChange={(event) => updateOption(index, event.target.value)} placeholder={`${copy.option} ${index + 1}`} required aria-label={`${copy.option} ${index + 1}`} /></label><button type="button" className="text-button text-button-danger" onClick={() => removeOption(index)} disabled={options.length <= 2}>{copy.remove}</button></div>)}</fieldset>
    <div className="quiz-option-toolbar"><button type="button" className="text-button" onClick={addOption} disabled={!editable || pending || options.length >= 6}>{copy.add}</button><small>{options.length} {copy.hint}</small></div>
    <div className="quiz-question-actions"><ActionButton className="button button-small" type="submit" isPending={pending} pendingLabel={pendingLabel} disabled={!editable}>{submitLabel}</ActionButton>{actions}</div>
  </form>;
}

function QuizBuilder({ lessonId, editable }: { lessonId: number; editable: boolean }) {
  const { locale } = useLanguage();
  const copy = locale === "fr" ? { loadError: "Nous n’avons pas pu charger l’éditeur de quiz.", settingsError: "Nous n’avons pas pu enregistrer les paramètres du quiz.", incomplete: "Ajoutez une question, 2 à 6 choix complets et sélectionnez une seule bonne réponse.", saveError: "Nous n’avons pas pu enregistrer cette question.", updateError: "Nous n’avons pas pu modifier cette question.", secure: "Évaluation sécurisée", builder: "Éditeur de quiz", question: "question", questions: "questions", instructions: "Instructions", passing: "Pourcentage de réussite", saveSettings: "Enregistrer les paramètres", saving: "Enregistrement…", loading: "Chargement des questions…", empty: "Aucune question enregistrée. Ajoutez votre première question avant de soumettre le cours.", saveQuestion: "Enregistrer la question", moveUp: "Monter", moveDown: "Descendre", delete: "Supprimer", addTitle: "Ajouter une question", newQuestion: "Nouvelle question", addQuestion: "Ajouter la question", adding: "Ajout…", saveFirst: "Enregistrez les paramètres du quiz avant d’ajouter des questions." } : locale === "es" ? { loadError: "No pudimos cargar el editor del cuestionario.", settingsError: "No pudimos guardar la configuración del cuestionario.", incomplete: "Añade una pregunta, de 2 a 6 opciones completas y selecciona una sola respuesta correcta.", saveError: "No pudimos guardar esta pregunta.", updateError: "No pudimos actualizar esta pregunta.", secure: "Evaluación segura", builder: "Editor de cuestionarios", question: "pregunta", questions: "preguntas", instructions: "Instrucciones", passing: "Porcentaje de aprobación", saveSettings: "Guardar configuración", saving: "Guardando…", loading: "Cargando preguntas…", empty: "Aún no hay preguntas guardadas. Añade la primera antes de enviar el curso.", saveQuestion: "Guardar pregunta", moveUp: "Subir", moveDown: "Bajar", delete: "Eliminar", addTitle: "Añadir pregunta", newQuestion: "Nueva pregunta", addQuestion: "Añadir pregunta", adding: "Añadiendo…", saveFirst: "Guarda la configuración antes de añadir preguntas." } : { loadError: "We couldn’t load this quiz builder.", settingsError: "We couldn’t save the quiz settings.", incomplete: "Add a question, 2–6 complete options, and select exactly one correct option before saving.", saveError: "We couldn’t save this question.", updateError: "We couldn’t update that question.", secure: "Secure assessment", builder: "Quiz builder", question: "question", questions: "questions", instructions: "Instructions", passing: "Passing percentage", saveSettings: "Save quiz settings", saving: "Saving…", loading: "Loading quiz questions…", empty: "No saved questions yet. Add your first question before submitting this course.", saveQuestion: "Save question", moveUp: "Move up", moveDown: "Move down", delete: "Delete", addTitle: "Add question", newQuestion: "New question", addQuestion: "Add question", adding: "Adding…", saveFirst: "Save quiz settings before adding questions." };
  const [rows, setRows] = useState<QuizAuthorRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [revision, setRevision] = useState(0);
  const quizId = rows?.[0]?.quiz_id;
  const load = useCallback(async () => { const { data, error: rpcError } = await createClient().rpc("get_own_instructor_quiz_authoring", { p_lesson_id: lessonId }); if (rpcError) setError(copy.loadError); else setRows((data ?? []) as QuizAuthorRow[]); }, [lessonId, copy.loadError]);
  useEffect(() => { const request = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(request); }, [load, revision]);
  async function saveConfig(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); setPending(true); setError(null); const { error: rpcError } = await createClient().rpc("upsert_instructor_quiz_configuration", { p_lesson_id: lessonId, p_instructions: String(form.get("instructions") ?? "").trim() || null, p_passing_percentage: Number(form.get("passing-percentage")) }); setPending(false); if (rpcError) setError(copy.settingsError); else setRevision((value) => value + 1); }
  async function saveQuestion(question: string, options: string[], correct: number, questionId?: number) { if (question.length < 2 || options.length < 2 || options.length > 6 || options.some((option) => option.length === 0) || !Number.isInteger(correct) || correct < 0 || correct >= options.length) { setError(copy.incomplete); return false; } setPending(true); setError(null); const { data, error: rpcError } = await createClient().rpc("upsert_instructor_quiz_question", { p_lesson_id: lessonId, p_question_id: questionId ?? null, p_question_text: question, p_options: options.map((option, index) => ({ option_text: option, is_correct: index === correct })) }); setPending(false); if (rpcError || !data?.[0]) { setError(copy.saveError); return false; } setRevision((value) => value + 1); return true; }
  async function questionAction(name: string, args: Record<string, unknown>) { setPending(true); setError(null); const { error: rpcError } = await createClient().rpc(name, args); setPending(false); if (rpcError) { setError(copy.updateError); return; } setRevision((value) => value + 1); }
  const grouped = new Map<number, QuizAuthorRow[]>(); rows?.forEach((row) => { if (row.question_id) grouped.set(row.question_id, [...(grouped.get(row.question_id) ?? []), row]); });
  return <section className="quiz-builder" aria-label={copy.builder}><div className="quiz-builder-heading"><div><p className="eyebrow">{copy.secure}</p><h3>{copy.builder}</h3></div><span>{grouped.size} {grouped.size === 1 ? copy.question : copy.questions}</span></div>{error && <InlineFeedback variant="error">{error}</InlineFeedback>}<form onSubmit={saveConfig} className="quiz-builder-config"><label className="course-field">{copy.instructions}<textarea name="instructions" defaultValue={rows?.[0]?.instructions ?? ""} rows={3} maxLength={2000} disabled={!editable || pending} /></label><label className="course-field">{copy.passing}<input name="passing-percentage" type="number" min="1" max="100" defaultValue={rows?.[0]?.passing_percentage ?? 70} disabled={!editable || pending} required /></label><ActionButton className="button button-small" type="submit" isPending={pending} pendingLabel={copy.saving} disabled={!editable}>{copy.saveSettings}</ActionButton></form>{rows === null ? <p>{copy.loading}</p> : !quizId || grouped.size === 0 ? <p className="published-outline-empty">{copy.empty}</p> : <ol className="quiz-builder-questions">{[...grouped.entries()].map(([questionId, questionRows], index) => { const first = questionRows[0]; const correctIndex = Math.max(0, questionRows.findIndex((row) => row.is_correct)); return <li key={questionId}><QuizQuestionEditor label={`${copy.question} ${index + 1}`} initialQuestion={first.question_text ?? ""} initialOptions={questionRows.map((row) => row.option_text ?? "")} initialCorrect={correctIndex} editable={editable} pending={pending} submitLabel={copy.saveQuestion} pendingLabel={copy.saving} onSave={(question, options, correct) => saveQuestion(question, options, correct, questionId)} actions={<div className="row-actions"><button type="button" className="text-button" disabled={!editable || pending || index === 0} onClick={() => questionAction("move_instructor_quiz_question", { p_lesson_id: lessonId, p_question_id: questionId, p_direction: "up" })}>{copy.moveUp}</button><button type="button" className="text-button" disabled={!editable || pending || index === grouped.size - 1} onClick={() => questionAction("move_instructor_quiz_question", { p_lesson_id: lessonId, p_question_id: questionId, p_direction: "down" })}>{copy.moveDown}</button><button type="button" className="text-button text-button-danger" disabled={!editable || pending} onClick={() => questionAction("delete_instructor_quiz_question", { p_lesson_id: lessonId, p_question_id: questionId })}>{copy.delete}</button></div>} /></li>; })}</ol>}<div className="quiz-builder-add"><h4>{copy.addTitle}</h4><QuizQuestionEditor key={`new-${revision}`} label={copy.newQuestion} editable={editable && Boolean(quizId)} pending={pending} submitLabel={copy.addQuestion} pendingLabel={copy.adding} onSave={(question, options, correct) => saveQuestion(question, options, correct)} isNew />{!quizId && <p>{copy.saveFirst}</p>}</div></section>;
}

function LessonEditor({ moduleId, lesson, editable, pendingKey, onSave, onMove, onDelete, isFirst, isLast }: { courseId: number; moduleId: number; lesson: CurriculumLesson | null; editable: boolean; pendingKey: string | null; onSave: (moduleId: number, lesson: CurriculumLesson | null, event: FormEvent<HTMLFormElement>) => Promise<void>; onMove: (direction: "up" | "down") => void; onDelete: () => void; isFirst: boolean; isLast: boolean }) {
  const { locale } = useLanguage();
  const copy = locale === "fr" ? { video: "Vidéo", quiz: "Quiz", text: "Texte", lesson: "leçon", add: "Ajouter une leçon", assessment: "Évaluation quiz", preview: "Aperçu", title: "Titre de la leçon", type: "Type de leçon", youtube: "URL ou identifiant YouTube", youtubeHelp: "Seuls les liens YouTube standard ou l’identifiant vidéo canonique de 11 caractères sont acceptés.", duration: "Durée (minutes)", visibility: "Visibilité chez le fournisseur", public: "Publique", unlisted: "Non répertoriée", visibilityHelp: "La visibilité du fournisseur ne protège pas le contenu payant.", content: "Contenu de la leçon", contentHelp: "Utilisez des titres et paragraphes clairs pour les apprenants.", quizHelp: "Enregistrez cette leçon quiz, puis configurez ses instructions, son seuil et ses questions ci-dessous.", markPreview: "Marquer comme aperçu du cours", save: "Enregistrer la leçon", adding: "Ajout…", saving: "Enregistrement…", moveUp: "Monter", moveDown: "Descendre", delete: "Supprimer" } : locale === "es" ? { video: "Vídeo", quiz: "Cuestionario", text: "Texto", lesson: "lección", add: "Añadir lección", assessment: "Evaluación", preview: "Vista previa", title: "Título de la lección", type: "Tipo de lección", youtube: "URL o ID de YouTube", youtubeHelp: "Solo se aceptan enlaces estándar de YouTube o el ID canónico de 11 caracteres.", duration: "Duración (minutos)", visibility: "Visibilidad del proveedor", public: "Público", unlisted: "No listado", visibilityHelp: "La visibilidad del proveedor no protege el contenido de pago.", content: "Contenido de la lección", contentHelp: "Usa títulos y párrafos claros para los estudiantes.", quizHelp: "Guarda esta lección y configura después sus instrucciones, puntuación y preguntas.", markPreview: "Marcar como vista previa del curso", save: "Guardar lección", adding: "Añadiendo…", saving: "Guardando…", moveUp: "Subir", moveDown: "Bajar", delete: "Eliminar" } : { video: "Video", quiz: "Quiz", text: "Text", lesson: "lesson", add: "Add lesson", assessment: "Quiz assessment", preview: "Preview", title: "Lesson title", type: "Lesson type", youtube: "YouTube URL or video ID", youtubeHelp: "Only standard YouTube links or the canonical 11-character video ID are accepted.", duration: "Duration (minutes)", visibility: "Provider visibility", public: "Public", unlisted: "Unlisted", visibilityHelp: "Provider visibility is not paid-content protection.", content: "Lesson content", contentHelp: "Keep headings and paragraphs clear for learners.", quizHelp: "Save this quiz lesson, then configure its instructions, passing score, questions, and correct answers below.", markPreview: "Mark as a course preview", save: "Save lesson", adding: "Adding…", saving: "Saving…", moveUp: "Move up", moveDown: "Move down", delete: "Delete" };
  const [type, setType] = useState<"video" | "text" | "quiz">(lesson?.type ?? "video");
  const busy = Boolean(pendingKey);
  const key = lesson ? `lesson-${lesson.id}` : `add-lesson-${moduleId}`;
  return <details className="lesson-editor" open={!lesson}><summary><span>{lesson ? `${lesson.type === "video" ? copy.video : lesson.type === "quiz" ? copy.quiz : copy.text} ${copy.lesson}` : copy.add}</span>{lesson && <><strong>{lesson.title}</strong><small>{lesson.type === "video" ? formatDuration(lesson.durationSeconds) : lesson.type === "quiz" ? copy.assessment : `${copy.text} ${copy.lesson}`}{lesson.isPreview ? ` · ${copy.preview}` : ""}</small></>}</summary><form onSubmit={(event) => onSave(moduleId, lesson, event)}><fieldset disabled={!editable || busy}><label className="course-field">{copy.title}<input name="title" defaultValue={lesson?.title ?? ""} minLength={2} maxLength={160} required /></label><label className="course-field">{copy.type}<select name="lesson-type" value={type} onChange={(event) => setType(event.target.value as "video" | "text" | "quiz")}><option value="video">{copy.video}</option><option value="text">{copy.text}</option><option value="quiz">{copy.quiz}</option></select></label>{type === "video" ? <><label className="course-field">{copy.youtube}<input name="youtube-url" defaultValue={lesson?.videoReference ?? ""} placeholder="https://www.youtube.com/watch?v=…" required /><span>{copy.youtubeHelp}</span></label><div className="course-form-grid"><label className="course-field">{copy.duration}<input name="duration-minutes" type="number" min="1" max="1440" defaultValue={lesson?.durationSeconds ? Math.round(lesson.durationSeconds / 60) : ""} required /></label><label className="course-field">{copy.visibility}<select name="video-visibility" defaultValue={lesson?.videoVisibility === "unlisted" ? "unlisted" : "public"}><option value="public">{copy.public}</option><option value="unlisted">{copy.unlisted}</option></select><span>{copy.visibilityHelp}</span></label></div></> : type === "text" ? <label className="course-field">{copy.content}<textarea name="content" defaultValue={lesson?.content ?? ""} rows={7} maxLength={20000} required /><span>{copy.contentHelp}</span></label> : <p className="course-field">{copy.quizHelp}</p>}<label className="lesson-preview"><input name="is-preview" type="checkbox" defaultChecked={lesson?.isPreview ?? false} />{copy.markPreview}</label></fieldset><div className="lesson-actions"><ActionButton className="button button-small" type="submit" isPending={pendingKey === key} pendingLabel={lesson ? copy.saving : copy.adding} disabled={!editable}>{lesson ? copy.save : copy.add}</ActionButton>{lesson && <div className="row-actions"><button type="button" className="text-button" onClick={() => onMove("up")} disabled={!editable || busy || isFirst}>{copy.moveUp}</button><button type="button" className="text-button" onClick={() => onMove("down")} disabled={!editable || busy || isLast}>{copy.moveDown}</button><button type="button" className="text-button text-button-danger" onClick={onDelete} disabled={!editable || busy}>{copy.delete}</button></div>}</div></form></details>;
}
