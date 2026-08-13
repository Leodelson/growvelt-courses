"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/app/components/ui/action-button";
import { ConfirmationDialog } from "@/app/components/ui/confirmation-dialog";
import { InlineFeedback } from "@/app/components/ui/inline-feedback";
import type { CurriculumLesson, CurriculumModule } from "@/app/lib/instructor/curriculum";
import type { CourseStatus } from "@/app/lib/instructor/course-options";
import { createClient } from "@/app/lib/supabase/browser";

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

function mutationError() { return "We couldn’t save that curriculum change. Review the details and try again."; }

export function CurriculumEditor({ courseId, status, initialModules }: { courseId: number; status: CourseStatus; initialModules: CurriculumModule[] }) {
  const router = useRouter();
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
    if (error) { setFeedback({ variant: "error", message: mutationError() }); return false; }
    router.refresh();
    return true;
  }

  async function addModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const title = String(new FormData(formElement).get("module-title") ?? "").trim();
    if (title.length < 2) { setFeedback({ variant: "error", message: "Enter a module title with at least two characters." }); return; }
    if (await call("add_instructor_course_module", { p_course_id: courseId, p_title: title }, "add-module")) { formElement.reset(); setFeedback({ variant: "success", message: "Module added to this draft." }); }
  }

  async function updateModule(moduleId: number, event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const title = String(new FormData(event.currentTarget).get("title") ?? "").trim();
    if (title.length < 2) { setFeedback({ variant: "error", message: "Enter a module title with at least two characters." }); return; }
    if (await call("update_instructor_course_module", { p_module_id: moduleId, p_title: title }, `module-${moduleId}`)) setFeedback({ variant: "success", message: "Module title saved." });
  }

  async function saveLesson(moduleId: number, lesson: CurriculumLesson | null, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const title = String(form.get("title") ?? "").trim(); const type = String(form.get("lesson-type") ?? "text");
    const content = String(form.get("content") ?? "").trim(); const reference = youtubeReference(String(form.get("youtube-url") ?? ""));
    const minutes = Number(form.get("duration-minutes")); const duration = Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : null;
    if (title.length < 2) { setFeedback({ variant: "error", message: "Enter a lesson title with at least two characters." }); return; }
    if (type === "video" && (!reference || !duration)) { setFeedback({ variant: "error", message: "Enter a supported YouTube URL or video ID and a duration in minutes." }); return; }
    if (type === "text" && !content) { setFeedback({ variant: "error", message: "Enter the text lesson content." }); return; }
    const args = { p_course_id: courseId, p_module_id: moduleId, p_title: title, p_lesson_type: type, p_content: content || null, p_video_provider: type === "video" ? "youtube" : null, p_video_reference: type === "video" ? reference : null, p_video_visibility: type === "video" ? String(form.get("video-visibility") ?? "public") : null, p_duration_seconds: type === "video" ? duration : null, p_is_preview: form.get("is-preview") === "on" };
    const name = lesson ? "update_instructor_course_lesson" : "add_instructor_course_lesson";
    const payload = lesson ? { p_lesson_id: lesson.id, p_module_id: moduleId, p_title: title, p_lesson_type: type, p_content: content || null, p_video_provider: type === "video" ? "youtube" : null, p_video_reference: type === "video" ? reference : null, p_video_visibility: type === "video" ? String(form.get("video-visibility") ?? "public") : null, p_duration_seconds: type === "video" ? duration : null, p_is_preview: form.get("is-preview") === "on" } : args;
    if (await call(name, payload, lesson ? `lesson-${lesson.id}` : `add-lesson-${moduleId}`)) { if (!lesson) formElement.reset(); setFeedback({ variant: "success", message: lesson ? "Lesson saved." : "Lesson added to this module." }); }
  }

  async function confirmDelete() {
    if (!confirm) return;
    const target = confirm;
    if (await call(target.kind === "module" ? "delete_instructor_course_module" : "delete_instructor_course_lesson", target.kind === "module" ? { p_module_id: target.id } : { p_lesson_id: target.id }, `delete-${target.kind}-${target.id}`)) { setConfirm(null); setFeedback({ variant: "success", message: target.kind === "module" ? "Module and its lessons deleted." : "Lesson deleted." }); }
  }

  return <div className="curriculum-editor">
    {!editable && <InlineFeedback variant="info">This course is {status.replace("_", " ")}. Curriculum is read-only until it returns to draft status.</InlineFeedback>}
    {feedback && <InlineFeedback variant={feedback.variant}>{feedback.message}</InlineFeedback>}
    <section className="curriculum-toolbar" aria-labelledby="curriculum-title"><div><p className="eyebrow">Course structure</p><h1 id="curriculum-title">Curriculum</h1><p>Create focused modules with text, video, and quiz activities. Every save is deliberate, and unsaved quiz changes are clearly marked.</p></div><form onSubmit={addModule} className="add-module-form"><label className="sr-only" htmlFor="module-title">New module title</label><input id="module-title" name="module-title" placeholder="Module title" maxLength={160} disabled={!editable || Boolean(pendingKey)} /><ActionButton className="button button-primary" type="submit" isPending={pendingKey === "add-module"} pendingLabel="Adding…" disabled={!editable}>Add module</ActionButton></form></section>
    {modules.length === 0 ? <section className="curriculum-empty"><p className="eyebrow">Start here</p><h2>Build the first section of this course.</h2><p>A module groups related lessons. You can add, rename, move, or remove it while this course is a draft.</p></section> : <ol className="curriculum-modules">{modules.map((module, index) => <li key={module.id} className="curriculum-module"><div className="module-heading"><span className="module-order">{String(index + 1).padStart(2, "0")}</span><form onSubmit={(event) => updateModule(module.id, event)} className="module-title-form"><label className="sr-only" htmlFor={`module-${module.id}`}>Module title</label><input id={`module-${module.id}`} name="title" defaultValue={module.title} maxLength={160} disabled={!editable || Boolean(pendingKey)} /><ActionButton className="button button-small" type="submit" isPending={pendingKey === `module-${module.id}`} pendingLabel="Saving…" disabled={!editable}>Save</ActionButton></form><div className="row-actions"><button type="button" className="text-button" onClick={() => call("move_instructor_course_module", { p_module_id: module.id, p_direction: "up" }, `module-move-${module.id}`)} disabled={!editable || Boolean(pendingKey) || index === 0}>Move up</button><button type="button" className="text-button" onClick={() => call("move_instructor_course_module", { p_module_id: module.id, p_direction: "down" }, `module-move-${module.id}`)} disabled={!editable || Boolean(pendingKey) || index === modules.length - 1}>Move down</button><button type="button" className="text-button text-button-danger" onClick={() => setConfirm({ kind: "module", id: module.id, title: module.title, lessonCount: module.lessons.length })} disabled={!editable || Boolean(pendingKey)}>Delete</button></div></div>
      <div className="lesson-list">{module.lessons.map((lesson, lessonIndex) => <div key={lesson.id}><LessonEditor courseId={courseId} moduleId={module.id} lesson={lesson} editable={editable} pendingKey={pendingKey} onSave={saveLesson} onMove={(direction) => call("move_instructor_course_lesson", { p_lesson_id: lesson.id, p_direction: direction }, `lesson-move-${lesson.id}`)} onDelete={() => setConfirm({ kind: "lesson", id: lesson.id, title: lesson.title })} isFirst={lessonIndex === 0} isLast={lessonIndex === module.lessons.length - 1} />{lesson.type === "quiz" && <QuizBuilder lessonId={lesson.id} editable={editable} />}</div>)}</div>
      {editable && <LessonEditor courseId={courseId} moduleId={module.id} lesson={null} editable={editable} pendingKey={pendingKey} onSave={saveLesson} onMove={() => undefined} onDelete={() => undefined} isFirst={false} isLast={false} />}</li>)}</ol>}
    {confirm && <ConfirmationDialog title={confirm.kind === "module" ? "Delete this module?" : "Delete this lesson?"} description={<p>{confirm.kind === "module" ? `This will permanently remove “${confirm.title}”${confirm.lessonCount ? ` and its ${confirm.lessonCount} lesson${confirm.lessonCount === 1 ? "" : "s"}` : ""}.` : `This will permanently remove “${confirm.title}” from this draft.`}</p>} confirmLabel={confirm.kind === "module" ? "Delete module" : "Delete lesson"} pendingLabel="Deleting…" tone="danger" isPending={pendingKey === `delete-${confirm.kind}-${confirm.id}`} onCancel={() => !pendingKey && setConfirm(null)} onConfirm={confirmDelete} />}
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
    <div className="quiz-question-heading"><strong>{label}</strong><span className={dirty || isNew ? "quiz-save-state is-unsaved" : "quiz-save-state"}>{dirty ? "Unsaved changes" : isNew ? "Not saved yet" : "Saved"}</span></div>
    <label className="course-field">Question<textarea value={question} onChange={(event) => { setQuestion(event.target.value); setDirty(true); }} rows={2} required disabled={!editable || pending} /></label>
    <fieldset className="quiz-option-editor" disabled={!editable || pending}><legend>Answer options</legend>{options.map((option, index) => <div className="quiz-author-option" key={index}><label className="quiz-option"><input type="radio" name="correct-option" value={index} checked={correctOption === index} onChange={() => { setCorrectOption(index); setDirty(true); }} /><input value={option} onChange={(event) => updateOption(index, event.target.value)} placeholder={`Option ${index + 1}`} required aria-label={`Option ${index + 1}`} /></label><button type="button" className="text-button text-button-danger" onClick={() => removeOption(index)} disabled={options.length <= 2}>Remove</button></div>)}</fieldset>
    <div className="quiz-option-toolbar"><button type="button" className="text-button" onClick={addOption} disabled={!editable || pending || options.length >= 6}>+ Add option</button><small>{options.length} of 6 options · Select one correct answer</small></div>
    <div className="quiz-question-actions"><ActionButton className="button button-small" type="submit" isPending={pending} pendingLabel={pendingLabel} disabled={!editable}>{submitLabel}</ActionButton>{actions}</div>
  </form>;
}

function QuizBuilder({ lessonId, editable }: { lessonId: number; editable: boolean }) {
  const [rows, setRows] = useState<QuizAuthorRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [revision, setRevision] = useState(0);
  const quizId = rows?.[0]?.quiz_id;
  const load = useCallback(async () => { const { data, error: rpcError } = await createClient().rpc("get_own_instructor_quiz_authoring", { p_lesson_id: lessonId }); if (rpcError) setError("We couldn’t load this quiz builder."); else setRows((data ?? []) as QuizAuthorRow[]); }, [lessonId]);
  useEffect(() => { const request = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(request); }, [load, revision]);
  async function saveConfig(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); setPending(true); setError(null); const { error: rpcError } = await createClient().rpc("upsert_instructor_quiz_configuration", { p_lesson_id: lessonId, p_instructions: String(form.get("instructions") ?? "").trim() || null, p_passing_percentage: Number(form.get("passing-percentage")) }); setPending(false); if (rpcError) setError("We couldn’t save the quiz settings."); else setRevision((value) => value + 1); }
  async function saveQuestion(question: string, options: string[], correct: number, questionId?: number) { if (question.length < 2 || options.length < 2 || options.length > 6 || options.some((option) => option.length === 0) || !Number.isInteger(correct) || correct < 0 || correct >= options.length) { setError("Add a question, 2–6 complete options, and select exactly one correct option before saving."); return false; } setPending(true); setError(null); const { data, error: rpcError } = await createClient().rpc("upsert_instructor_quiz_question", { p_lesson_id: lessonId, p_question_id: questionId ?? null, p_question_text: question, p_options: options.map((option, index) => ({ option_text: option, is_correct: index === correct })) }); setPending(false); if (rpcError || !data?.[0]) { setError("We couldn’t save this question. It has not been added to the course yet."); return false; } setRevision((value) => value + 1); return true; }
  async function questionAction(name: string, args: Record<string, unknown>) { setPending(true); setError(null); const { error: rpcError } = await createClient().rpc(name, args); setPending(false); if (rpcError) { setError("We couldn’t update that question. Your existing saved questions were not changed."); return; } setRevision((value) => value + 1); }
  const grouped = new Map<number, QuizAuthorRow[]>(); rows?.forEach((row) => { if (row.question_id) grouped.set(row.question_id, [...(grouped.get(row.question_id) ?? []), row]); });
  return <section className="quiz-builder" aria-label="Quiz builder"><div className="quiz-builder-heading"><div><p className="eyebrow">Secure assessment</p><h3>Quiz builder</h3></div><span>{grouped.size} {grouped.size === 1 ? "question" : "questions"}</span></div>{error && <InlineFeedback variant="error">{error}</InlineFeedback>}<form onSubmit={saveConfig} className="quiz-builder-config"><label className="course-field">Instructions<textarea name="instructions" defaultValue={rows?.[0]?.instructions ?? ""} rows={3} maxLength={2000} disabled={!editable || pending} /></label><label className="course-field">Passing percentage<input name="passing-percentage" type="number" min="1" max="100" defaultValue={rows?.[0]?.passing_percentage ?? 70} disabled={!editable || pending} required /></label><ActionButton className="button button-small" type="submit" isPending={pending} pendingLabel="Saving…" disabled={!editable}>Save quiz settings</ActionButton></form>{rows === null ? <p>Loading quiz questions…</p> : !quizId || grouped.size === 0 ? <p className="published-outline-empty">No saved questions yet. Add and save your first question before submitting this course for review.</p> : <ol className="quiz-builder-questions">{[...grouped.entries()].map(([questionId, questionRows], index) => { const first = questionRows[0]; const correctIndex = Math.max(0, questionRows.findIndex((row) => row.is_correct)); return <li key={questionId}><QuizQuestionEditor label={`Question ${index + 1}`} initialQuestion={first.question_text ?? ""} initialOptions={questionRows.map((row) => row.option_text ?? "")} initialCorrect={correctIndex} editable={editable} pending={pending} submitLabel="Save question" pendingLabel="Saving…" onSave={(question, options, correct) => saveQuestion(question, options, correct, questionId)} actions={<div className="row-actions"><button type="button" className="text-button" disabled={!editable || pending || index === 0} onClick={() => questionAction("move_instructor_quiz_question", { p_lesson_id: lessonId, p_question_id: questionId, p_direction: "up" })}>Move up</button><button type="button" className="text-button" disabled={!editable || pending || index === grouped.size - 1} onClick={() => questionAction("move_instructor_quiz_question", { p_lesson_id: lessonId, p_question_id: questionId, p_direction: "down" })}>Move down</button><button type="button" className="text-button text-button-danger" disabled={!editable || pending} onClick={() => questionAction("delete_instructor_quiz_question", { p_lesson_id: lessonId, p_question_id: questionId })}>Delete</button></div>} /></li>; })}</ol>}<div className="quiz-builder-add"><h4>Add question</h4><QuizQuestionEditor key={`new-${revision}`} label="New question" editable={editable && Boolean(quizId)} pending={pending} submitLabel="Add question" pendingLabel="Adding…" onSave={(question, options, correct) => saveQuestion(question, options, correct)} isNew />{!quizId && <p>Save quiz settings before adding questions.</p>}</div></section>;
}

function LessonEditor({ moduleId, lesson, editable, pendingKey, onSave, onMove, onDelete, isFirst, isLast }: { courseId: number; moduleId: number; lesson: CurriculumLesson | null; editable: boolean; pendingKey: string | null; onSave: (moduleId: number, lesson: CurriculumLesson | null, event: FormEvent<HTMLFormElement>) => Promise<void>; onMove: (direction: "up" | "down") => void; onDelete: () => void; isFirst: boolean; isLast: boolean }) {
  const [type, setType] = useState<"video" | "text" | "quiz">(lesson?.type ?? "video");
  const busy = Boolean(pendingKey);
  const key = lesson ? `lesson-${lesson.id}` : `add-lesson-${moduleId}`;
  return <details className="lesson-editor" open={!lesson}><summary><span>{lesson ? `${lesson.type === "video" ? "Video" : lesson.type === "quiz" ? "Quiz" : "Text"} lesson` : "Add lesson"}</span>{lesson && <><strong>{lesson.title}</strong><small>{lesson.type === "video" ? formatDuration(lesson.durationSeconds) : lesson.type === "quiz" ? "Quiz assessment" : "Text lesson"}{lesson.isPreview ? " · Preview" : ""}</small></>}</summary><form onSubmit={(event) => onSave(moduleId, lesson, event)}><fieldset disabled={!editable || busy}><label className="course-field">Lesson title<input name="title" defaultValue={lesson?.title ?? ""} minLength={2} maxLength={160} required /></label><label className="course-field">Lesson type<select name="lesson-type" value={type} onChange={(event) => setType(event.target.value as "video" | "text" | "quiz")}><option value="video">Video</option><option value="text">Text</option><option value="quiz">Quiz</option></select></label>{type === "video" ? <><label className="course-field">YouTube URL or video ID<input name="youtube-url" defaultValue={lesson?.videoReference ?? ""} placeholder="https://www.youtube.com/watch?v=…" required /><span>Only standard YouTube links or the canonical 11-character video ID are accepted. Growvelt stores the reference, not video files or embed code.</span></label><div className="course-form-grid"><label className="course-field">Duration (minutes)<input name="duration-minutes" type="number" min="1" max="1440" defaultValue={lesson?.durationSeconds ? Math.round(lesson.durationSeconds / 60) : ""} required /></label><label className="course-field">Provider visibility<select name="video-visibility" defaultValue={lesson?.videoVisibility === "unlisted" ? "unlisted" : "public"}><option value="public">Public</option><option value="unlisted">Unlisted</option></select><span>Provider visibility is not paid-content protection.</span></label></div></> : type === "text" ? <label className="course-field">Lesson content<textarea name="content" defaultValue={lesson?.content ?? ""} rows={7} maxLength={20000} required /><span>Plain text lesson content. Keep headings and paragraphs clear for learners.</span></label> : <p className="course-field">Save this quiz lesson, then configure its instructions, passing score, questions, and correct answers in the secure builder below.</p>}<label className="lesson-preview"><input name="is-preview" type="checkbox" defaultChecked={lesson?.isPreview ?? false} />Mark as a course preview</label></fieldset><div className="lesson-actions"><ActionButton className="button button-small" type="submit" isPending={pendingKey === key} pendingLabel={lesson ? "Saving…" : "Adding…"} disabled={!editable}>{lesson ? "Save lesson" : "Add lesson"}</ActionButton>{lesson && <div className="row-actions"><button type="button" className="text-button" onClick={() => onMove("up")} disabled={!editable || busy || isFirst}>Move up</button><button type="button" className="text-button" onClick={() => onMove("down")} disabled={!editable || busy || isLast}>Move down</button><button type="button" className="text-button text-button-danger" onClick={onDelete} disabled={!editable || busy}>Delete</button></div>}</div></form></details>;
}
