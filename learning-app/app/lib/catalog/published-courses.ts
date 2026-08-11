import { createClient } from "@/app/lib/supabase/server";

export type PublishedCourse = {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  category: string | null;
  level: string | null;
  isFree: boolean;
  priceAmount: number | null;
  priceCurrency: string | null;
  instructorName: string | null;
};

type PublishedCourseRow = {
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
};

type PublishedCourseDetailRow = {
  course_id: number;
  slug: string;
  course_title: string;
  summary: string | null;
  description: string | null;
  category: string | null;
  level: string | null;
  is_free: boolean;
  price_amount: number | null;
  price_currency: string | null;
  instructor_name: string | null;
  published_at: string | null;
  module_id: number | null;
  module_title: string | null;
  module_position: number | null;
  lesson_id: number | null;
  lesson_title: string | null;
  lesson_type: "video" | "text" | null;
  is_preview: boolean | null;
  preview_text_content: string | null;
  preview_video_provider: string | null;
  preview_video_reference: string | null;
  preview_video_visibility: string | null;
  preview_duration_seconds: number | null;
  lesson_position: number | null;
};

export type PublishedCourseDetail = PublishedCourse & {
  description: string | null;
  publishedAt: string | null;
  modules: Array<{
    id: number;
    title: string;
    position: number;
    lessons: Array<{
      id: number;
      title: string;
      type: "video" | "text";
      isPreview: boolean;
      preview: {
        textContent: string | null;
        videoProvider: string | null;
        videoReference: string | null;
        videoVisibility: string | null;
        durationSeconds: number | null;
      } | null;
    }>;
  }>;
};

export async function listPublishedLearningCourses(): Promise<PublishedCourse[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_published_learning_courses", { p_limit: 24, p_offset: 0 });
  if (error) throw new Error("Unable to load published courses.");
  return ((data ?? []) as PublishedCourseRow[]).map((course) => ({
    id: course.course_id,
    slug: course.slug,
    title: course.title,
    summary: course.summary,
    category: course.category,
    level: course.level,
    isFree: course.is_free,
    priceAmount: course.price_amount,
    priceCurrency: course.price_currency,
    instructorName: course.instructor_name,
  }));
}

export async function getPublishedLearningCourse(slug: string): Promise<PublishedCourseDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_published_learning_course_by_slug", { p_slug: slug });
  if (error) throw new Error("Unable to load this published course.");
  const rows = (data ?? []) as PublishedCourseDetailRow[];
  const first = rows[0];
  if (!first) return null;

  const modules = new Map<number, PublishedCourseDetail["modules"][number]>();
  for (const row of rows) {
    if (row.module_id === null || row.module_title === null) continue;
    const courseModule = modules.get(row.module_id) ?? { id: row.module_id, title: row.module_title, position: row.module_position ?? 0, lessons: [] };
    if (row.lesson_id !== null && row.lesson_title !== null && (row.lesson_type === "video" || row.lesson_type === "text")) {
      courseModule.lessons.push({
        id: row.lesson_id,
        title: row.lesson_title,
        type: row.lesson_type,
        isPreview: Boolean(row.is_preview),
        preview: row.is_preview ? {
          textContent: row.preview_text_content,
          videoProvider: row.preview_video_provider,
          videoReference: row.preview_video_reference,
          videoVisibility: row.preview_video_visibility,
          durationSeconds: row.preview_duration_seconds,
        } : null,
      });
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
    priceAmount: first.price_amount,
    priceCurrency: first.price_currency,
    instructorName: first.instructor_name,
    publishedAt: first.published_at,
    modules: [...modules.values()],
  };
}
