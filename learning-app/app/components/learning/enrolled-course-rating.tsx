import { createClient } from "@/app/lib/supabase/server";
import { CourseRatingForm } from "./course-rating-form";

export async function EnrolledCourseRating({ courseId }: { courseId: number }) {
  const { data, error } = await (await createClient()).rpc("get_own_learning_course_rating", { p_course_id: courseId });
  if (error || !data?.[0]?.can_rate) return null;
  return <CourseRatingForm courseId={courseId} initialRating={data[0].rating ?? null} />;
}
