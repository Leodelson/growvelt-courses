import type { SupabaseClient } from "@supabase/supabase-js";

export type CourseRating = { averageRating?: number | null; ratingCount?: number };

export async function withCourseRatings<T extends { id: number }>(client: SupabaseClient, courses: T[]): Promise<(T & CourseRating)[]> {
  if (!courses.length) return courses;
  const { data, error } = await client.rpc("list_public_learning_course_ratings", { p_course_ids: courses.map((course) => course.id) });
  // Additive rollout: a missing ratings migration must never break browsing/checkout.
  if (error) return courses;
  const ratings = new Map<number, CourseRating>((data ?? []).map((row: { course_id: number; average_rating: number | null; rating_count: number }) => [Number(row.course_id), { averageRating: row.average_rating === null ? null : Number(row.average_rating), ratingCount: Number(row.rating_count) }]));
  return courses.map((course) => ({ ...course, ...ratings.get(course.id) }));
}
