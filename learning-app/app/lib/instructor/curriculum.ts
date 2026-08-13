import { createClient } from "@/app/lib/supabase/server";

export type CurriculumLesson = {
  id: number;
  title: string;
  type: "video" | "text" | "quiz";
  content: string | null;
  videoProvider: "youtube" | null;
  videoReference: string | null;
  videoVisibility: "public" | "unlisted" | "private" | null;
  durationSeconds: number | null;
  isPreview: boolean;
  position: number;
};

export type CurriculumModule = {
  id: number;
  title: string;
  position: number;
  lessons: CurriculumLesson[];
};

type CurriculumRow = {
  module_id: number;
  module_title: string;
  module_position: number;
  lesson_id: number | null;
  lesson_title: string | null;
  lesson_type: string | null;
  lesson_content: string | null;
  video_provider: string | null;
  video_reference: string | null;
  video_visibility: string | null;
  duration_seconds: number | null;
  is_preview: boolean | null;
  lesson_position: number | null;
  // The current RPC exposes lesson_title. `title` keeps the client resilient
  // during a transient PostgREST schema-cache refresh after a function deploy.
  title?: string | null;
};

export async function getOwnInstructorCurriculum(courseId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_own_instructor_curriculum", { p_course_id: courseId });

  if (error) throw new Error("Unable to load this curriculum.");

  const modules = new Map<number, CurriculumModule>();
  for (const row of (data ?? []) as CurriculumRow[]) {
    const courseModule = modules.get(row.module_id) ?? {
      id: row.module_id,
      title: row.module_title,
      position: row.module_position,
      lessons: [],
    };
    const lessonTitle = typeof row.lesson_title === "string" ? row.lesson_title : typeof row.title === "string" ? row.title : null;
    if (row.lesson_id !== null && lessonTitle !== null && (row.lesson_type === "video" || row.lesson_type === "text" || row.lesson_type === "quiz")) {
      courseModule.lessons.push({
        id: row.lesson_id,
        title: lessonTitle,
        type: row.lesson_type,
        content: row.lesson_content,
        videoProvider: row.video_provider === "youtube" ? "youtube" : null,
        videoReference: row.video_reference,
        videoVisibility: row.video_visibility === "public" || row.video_visibility === "unlisted" || row.video_visibility === "private" ? row.video_visibility : null,
        durationSeconds: row.duration_seconds,
        isPreview: Boolean(row.is_preview),
        position: row.lesson_position ?? 0,
      });
    }
    modules.set(row.module_id, courseModule);
  }

  return [...modules.values()];
}
