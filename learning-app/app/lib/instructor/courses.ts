import { createClient } from "@/app/lib/supabase/server";
import type { CourseStatus } from "@/app/lib/instructor/course-options";

export type InstructorCourseListItem = {
  course_id: number;
  title: string;
  summary: string | null;
  category: string | null;
  level: string | null;
  is_free: boolean;
  price_amount: number | null;
  price_currency: string | null;
  status: CourseStatus;
  updated_at: string;
  total_courses?: number;
};

export type InstructorCourse = InstructorCourseListItem & {
  slug: string;
  description: string | null;
  created_at: string;
};

export async function getOwnInstructorCourses() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_own_instructor_courses", { p_limit: 20, p_offset: 0 });

  if (error) throw new Error("Unable to load your courses.");
  return (data ?? []) as InstructorCourseListItem[];
}

export async function searchOwnInstructorCourses(query: string, status: string, page: number) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.min(page, 100000) : 1;
  const { data, error } = await (await createClient()).rpc("search_own_instructor_courses", {
    p_query: query || null,
    p_status: status || null,
    p_limit: 12,
    p_offset: (safePage - 1) * 12,
  });
  if (error) throw new Error("Unable to search your courses.");
  const courses = (data ?? []) as InstructorCourseListItem[];
  return { courses, total: courses[0]?.total_courses ?? 0, page: safePage, pageSize: 12 };
}

export async function getOwnInstructorCourse(courseId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_own_instructor_course", { p_course_id: courseId }).maybeSingle();

  if (error) throw new Error("Unable to load this course.");
  return data as InstructorCourse | null;
}
