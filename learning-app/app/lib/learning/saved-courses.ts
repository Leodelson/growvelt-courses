import type { PublishedCourse } from "@/app/lib/catalog/published-courses";
import { createClient } from "@/app/lib/supabase/server";

type SavedCourseRow = {
  course_id: number;
  slug: string;
  title: string;
  summary: string | null;
  category: string | null;
  level: string | null;
  is_free: boolean;
  price_amount: number | null;
  price_currency: string | null;
  instructor_name: string | null;
  saved_at: string;
};

function mapSavedCourse(row: SavedCourseRow): PublishedCourse {
  return {
    id: row.course_id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    category: row.category,
    level: row.level,
    isFree: row.is_free,
    priceAmount: row.price_amount,
    priceCurrency: row.price_currency,
    instructorName: row.instructor_name,
  };
}

export async function getOwnSavedLearningCourseIds(): Promise<number[]> {
  const { data, error } = await (await createClient()).rpc("get_own_saved_learning_course_ids");
  if (error) throw new Error("Unable to load saved courses.");
  return ((data ?? []) as Array<{ course_id: number }>).map((row) => row.course_id);
}

export async function listOwnSavedLearningCourses(): Promise<PublishedCourse[]> {
  const { data, error } = await (await createClient()).rpc("list_own_saved_learning_courses", { p_limit: 48, p_offset: 0 });
  if (error) throw new Error("Unable to load saved courses.");
  return ((data ?? []) as SavedCourseRow[]).map(mapSavedCourse);
}
