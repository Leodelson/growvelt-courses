import { createClient } from "@/app/lib/supabase/server";

type LessonSnapshotRow = {
  course_id: number; course_slug: string; course_title: string; enrollment_id: number; module_id: number; module_title: string; module_position: number; lesson_id: number; lesson_title: string; lesson_type: string; lesson_position: number; is_preview: boolean; is_current: boolean; is_completed: boolean; current_text_content: string | null; current_video_provider: string | null; current_video_reference: string | null; current_video_visibility: string | null; current_duration_seconds: number | null; previous_lesson_id: number | null; next_lesson_id: number | null;
};

export type EnrolledLessonSnapshot = {
  course: { id: number; slug: string; title: string };
  current: { id: number; title: string; type: string; textContent: string | null; videoProvider: string | null; videoReference: string | null; videoVisibility: string | null; durationSeconds: number | null; completed: boolean; previousId: number | null; nextId: number | null };
  modules: Array<{ id: number; title: string; lessons: Array<{ id: number; title: string; type: string; completed: boolean; current: boolean }> }>;
};

export async function getOwnEnrolledLessonSnapshot(slug: string, lessonId: number): Promise<EnrolledLessonSnapshot | null> {
  const { data, error } = await (await createClient()).rpc("get_own_enrolled_lesson_snapshot", { p_slug: slug, p_lesson_id: lessonId });
  if (error) throw new Error("Unable to load this lesson.");
  const rows = (data ?? []) as LessonSnapshotRow[];
  const current = rows.find((row) => row.is_current);
  if (!current) return null;
  const modules = new Map<number, EnrolledLessonSnapshot["modules"][number]>();
  for (const row of rows) {
    const courseModule = modules.get(row.module_id) ?? { id: row.module_id, title: row.module_title, lessons: [] };
    courseModule.lessons.push({ id: row.lesson_id, title: row.lesson_title, type: row.lesson_type, completed: row.is_completed, current: row.is_current });
    modules.set(row.module_id, courseModule);
  }
  return { course: { id: current.course_id, slug: current.course_slug, title: current.course_title }, current: { id: current.lesson_id, title: current.lesson_title, type: current.lesson_type, textContent: current.current_text_content, videoProvider: current.current_video_provider, videoReference: current.current_video_reference, videoVisibility: current.current_video_visibility, durationSeconds: current.current_duration_seconds, completed: current.is_completed, previousId: current.previous_lesson_id, nextId: current.next_lesson_id }, modules: [...modules.values()] };
}
