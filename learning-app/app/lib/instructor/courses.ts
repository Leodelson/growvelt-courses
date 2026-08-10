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

export async function getOwnInstructorCourse(courseId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_own_instructor_course", { p_course_id: courseId }).maybeSingle();

  if (error) throw new Error("Unable to load this course.");
  return data as InstructorCourse | null;
}
