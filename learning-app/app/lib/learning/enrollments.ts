import { createClient } from "@/app/lib/supabase/server";

export type EnrollmentState = { isEnrolled: boolean; status: string | null; enrolledAt: string | null };
type EnrollmentRow = { course_id: number; slug: string; title: string; summary: string | null; category: string | null; level: string | null; is_free: boolean; instructor_name: string | null; enrolled_at: string; enrollment_status: "active" | "completed"; completed_lessons: number; total_lessons: number; progress_percent: number };
type EnrolledCourseRow = {
  course_id: number;
  slug: string;
  course_title: string;
  summary: string | null;
  description: string | null;
  category: string | null;
  level: string | null;
  is_free: boolean;
  instructor_name: string | null;
  enrolled_at: string;
  enrollment_status: "active" | "completed";
  enrollment_completed_at: string | null;
  completed_lessons: number;
  total_lessons: number;
  progress_percent: number;
  module_id: number | null;
  module_title: string | null;
  module_position: number | null;
  lesson_id: number | null;
  lesson_title: string | null;
  lesson_type: "video" | "text" | null;
  is_preview: boolean | null;
};

export type EnrolledLearningCourse = {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  category: string | null;
  level: string | null;
  isFree: boolean;
  instructorName: string | null;
  enrolledAt: string;
  enrollmentStatus: "active" | "completed";
  enrollmentCompletedAt: string | null;
  completedLessons: number;
  totalLessons: number;
  progressPercent: number;
  modules: Array<{
    id: number;
    title: string;
    position: number;
    lessons: Array<{ id: number; title: string; type: "video" | "text"; isPreview: boolean }>;
  }>;
};

export async function getEnrollmentState(courseId: number): Promise<EnrollmentState> {
  const { data, error } = await (await createClient()).rpc("get_own_learning_enrollment_state", { p_course_id: courseId });
  if (error) throw new Error("Unable to load enrollment status.");
  const row = (data ?? [])[0] as { is_enrolled: boolean; enrollment_status: string | null; enrolled_at: string | null } | undefined;
  return { isEnrolled: Boolean(row?.is_enrolled), status: row?.enrollment_status ?? null, enrolledAt: row?.enrolled_at ?? null };
}

export async function listOwnLearningEnrollments() {
  const { data, error } = await (await createClient()).rpc("list_own_learning_course_progress", { p_limit: 24, p_offset: 0 });
  if (error) throw new Error("Unable to load your enrolled courses.");
  return ((data ?? []) as EnrollmentRow[]).map((row) => ({ id: row.course_id, slug: row.slug, title: row.title, summary: row.summary, category: row.category, level: row.level, isFree: row.is_free, instructorName: row.instructor_name, enrolledAt: row.enrolled_at, enrollmentStatus: row.enrollment_status, completedLessons: row.completed_lessons, totalLessons: row.total_lessons, progressPercent: row.progress_percent }));
}

export async function getOwnEnrolledLearningCourse(slug: string): Promise<EnrolledLearningCourse | null> {
  const { data, error } = await (await createClient()).rpc("get_own_enrolled_learning_course_progress_by_slug", { p_slug: slug });
  if (error) throw new Error("Unable to load this enrolled course.");
  const rows = (data ?? []) as EnrolledCourseRow[];
  const first = rows[0];
  if (!first) return null;

  const modules = new Map<number, EnrolledLearningCourse["modules"][number]>();
  for (const row of rows) {
    if (row.module_id === null || row.module_title === null) continue;
    const courseModule = modules.get(row.module_id) ?? { id: row.module_id, title: row.module_title, position: row.module_position ?? 0, lessons: [] };
    if (row.lesson_id !== null && row.lesson_title !== null && (row.lesson_type === "video" || row.lesson_type === "text")) {
      courseModule.lessons.push({ id: row.lesson_id, title: row.lesson_title, type: row.lesson_type, isPreview: Boolean(row.is_preview) });
    }
    modules.set(row.module_id, courseModule);
  }

  return {
    id: first.course_id,
    slug: first.slug,
    title: first.course_title,
    summary: first.summary,
    description: first.description,
    category: first.category,
    level: first.level,
    isFree: first.is_free,
    instructorName: first.instructor_name,
    enrolledAt: first.enrolled_at,
    enrollmentStatus: first.enrollment_status,
    enrollmentCompletedAt: first.enrollment_completed_at,
    completedLessons: first.completed_lessons,
    totalLessons: first.total_lessons,
    progressPercent: first.progress_percent,
    modules: [...modules.values()],
  };
}
