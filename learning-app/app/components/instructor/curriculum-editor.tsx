"use client";

import { useState, type FormEvent } from "react";
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
    <section className="curriculum-toolbar" aria-labelledby="curriculum-title"><div><p className="eyebrow">Course structure</p><h1 id="curriculum-title">Curriculum</h1><p>Create concise sections, then add video or text lessons. Changes are saved deliberately—never while you type.</p></div><form onSubmit={addModule} className="add-module-form"><label className="sr-only" htmlFor="module-title">New module title</label><input id="module-title" name="module-title" placeholder="Module title" maxLength={160} disabled={!editable || Boolean(pendingKey)} /><ActionButton className="button button-primary" type="submit" isPending={pendingKey === "add-module"} pendingLabel="Adding…" disabled={!editable}>Add module</ActionButton></form></section>
    {modules.length === 0 ? <section className="curriculum-empty"><p className="eyebrow">Start here</p><h2>Build the first section of this course.</h2><p>A module groups related lessons. You can add, rename, move, or remove it while this course is a draft.</p></section> : <ol className="curriculum-modules">{modules.map((module, index) => <li key={module.id} className="curriculum-module"><div className="module-heading"><span className="module-order">{String(index + 1).padStart(2, "0")}</span><form onSubmit={(event) => updateModule(module.id, event)} className="module-title-form"><label className="sr-only" htmlFor={`module-${module.id}`}>Module title</label><input id={`module-${module.id}`} name="title" defaultValue={module.title} maxLength={160} disabled={!editable || Boolean(pendingKey)} /><ActionButton className="button button-small" type="submit" isPending={pendingKey === `module-${module.id}`} pendingLabel="Saving…" disabled={!editable}>Save</ActionButton></form><div className="row-actions"><button type="button" className="text-button" onClick={() => call("move_instructor_course_module", { p_module_id: module.id, p_direction: "up" }, `module-move-${module.id}`)} disabled={!editable || Boolean(pendingKey) || index === 0}>Move up</button><button type="button" className="text-button" onClick={() => call("move_instructor_course_module", { p_module_id: module.id, p_direction: "down" }, `module-move-${module.id}`)} disabled={!editable || Boolean(pendingKey) || index === modules.length - 1}>Move down</button><button type="button" className="text-button text-button-danger" onClick={() => setConfirm({ kind: "module", id: module.id, title: module.title, lessonCount: module.lessons.length })} disabled={!editable || Boolean(pendingKey)}>Delete</button></div></div>
      <div className="lesson-list">{module.lessons.map((lesson, lessonIndex) => <LessonEditor key={lesson.id} courseId={courseId} moduleId={module.id} lesson={lesson} editable={editable} pendingKey={pendingKey} onSave={saveLesson} onMove={(direction) => call("move_instructor_course_lesson", { p_lesson_id: lesson.id, p_direction: direction }, `lesson-move-${lesson.id}`)} onDelete={() => setConfirm({ kind: "lesson", id: lesson.id, title: lesson.title })} isFirst={lessonIndex === 0} isLast={lessonIndex === module.lessons.length - 1} />)}</div>
      {editable && <LessonEditor courseId={courseId} moduleId={module.id} lesson={null} editable={editable} pendingKey={pendingKey} onSave={saveLesson} onMove={() => undefined} onDelete={() => undefined} isFirst={false} isLast={false} />}</li>)}</ol>}
    {confirm && <ConfirmationDialog title={confirm.kind === "module" ? "Delete this module?" : "Delete this lesson?"} description={<p>{confirm.kind === "module" ? `This will permanently remove “${confirm.title}”${confirm.lessonCount ? ` and its ${confirm.lessonCount} lesson${confirm.lessonCount === 1 ? "" : "s"}` : ""}.` : `This will permanently remove “${confirm.title}” from this draft.`}</p>} confirmLabel={confirm.kind === "module" ? "Delete module" : "Delete lesson"} pendingLabel="Deleting…" tone="danger" isPending={pendingKey === `delete-${confirm.kind}-${confirm.id}`} onCancel={() => !pendingKey && setConfirm(null)} onConfirm={confirmDelete} />}
  </div>;
}

function LessonEditor({ moduleId, lesson, editable, pendingKey, onSave, onMove, onDelete, isFirst, isLast }: { courseId: number; moduleId: number; lesson: CurriculumLesson | null; editable: boolean; pendingKey: string | null; onSave: (moduleId: number, lesson: CurriculumLesson | null, event: FormEvent<HTMLFormElement>) => Promise<void>; onMove: (direction: "up" | "down") => void; onDelete: () => void; isFirst: boolean; isLast: boolean }) {
  const [type, setType] = useState<"video" | "text">(lesson?.type ?? "video");
  const busy = Boolean(pendingKey);
  const key = lesson ? `lesson-${lesson.id}` : `add-lesson-${moduleId}`;
  return <details className="lesson-editor" open={!lesson}><summary><span>{lesson ? `${lesson.type === "video" ? "Video" : "Text"} lesson` : "Add lesson"}</span>{lesson && <><strong>{lesson.title}</strong><small>{lesson.type === "video" ? formatDuration(lesson.durationSeconds) : "Text lesson"}{lesson.isPreview ? " · Preview" : ""}</small></>}</summary><form onSubmit={(event) => onSave(moduleId, lesson, event)}><fieldset disabled={!editable || busy}><label className="course-field">Lesson title<input name="title" defaultValue={lesson?.title ?? ""} minLength={2} maxLength={160} required /></label><label className="course-field">Lesson type<select name="lesson-type" value={type} onChange={(event) => setType(event.target.value as "video" | "text")}><option value="video">Video</option><option value="text">Text</option></select></label>{type === "video" ? <><label className="course-field">YouTube URL or video ID<input name="youtube-url" defaultValue={lesson?.videoReference ?? ""} placeholder="https://www.youtube.com/watch?v=…" required /><span>Only standard YouTube links or the canonical 11-character video ID are accepted. Growvelt stores the reference, not video files or embed code.</span></label><div className="course-form-grid"><label className="course-field">Duration (minutes)<input name="duration-minutes" type="number" min="1" max="1440" defaultValue={lesson?.durationSeconds ? Math.round(lesson.durationSeconds / 60) : ""} required /></label><label className="course-field">Provider visibility<select name="video-visibility" defaultValue={lesson?.videoVisibility === "unlisted" ? "unlisted" : "public"}><option value="public">Public</option><option value="unlisted">Unlisted</option></select><span>Provider visibility is not paid-content protection.</span></label></div></> : <label className="course-field">Lesson content<textarea name="content" defaultValue={lesson?.content ?? ""} rows={7} maxLength={20000} required /><span>Plain text only for this first authoring checkpoint.</span></label>}<label className="lesson-preview"><input name="is-preview" type="checkbox" defaultChecked={lesson?.isPreview ?? false} />Mark as a future course preview</label></fieldset><div className="lesson-actions"><ActionButton className="button button-small" type="submit" isPending={pendingKey === key} pendingLabel={lesson ? "Saving…" : "Adding…"} disabled={!editable}>{lesson ? "Save lesson" : "Add lesson"}</ActionButton>{lesson && <div className="row-actions"><button type="button" className="text-button" onClick={() => onMove("up")} disabled={!editable || busy || isFirst}>Move up</button><button type="button" className="text-button" onClick={() => onMove("down")} disabled={!editable || busy || isLast}>Move down</button><button type="button" className="text-button text-button-danger" onClick={onDelete} disabled={!editable || busy}>Delete</button></div>}</div></form></details>;
}
