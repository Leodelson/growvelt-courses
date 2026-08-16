import type { MetadataRoute } from "next";
import { createClient } from "@/app/lib/supabase/server";
import { absoluteLearningUrl } from "@/app/lib/seo";

export const revalidate = 3600;

type SitemapCourseRow = {
  slug: string;
  published_at: string | null;
};

const staticPages: MetadataRoute.Sitemap = [
  { url: absoluteLearningUrl("/"), changeFrequency: "weekly", priority: 1 },
  { url: absoluteLearningUrl("/learn"), changeFrequency: "daily", priority: 0.9 },
  { url: absoluteLearningUrl("/teach"), changeFrequency: "monthly", priority: 0.7 },
  { url: absoluteLearningUrl("/about"), changeFrequency: "monthly", priority: 0.7 },
  { url: absoluteLearningUrl("/blog"), changeFrequency: "weekly", priority: 0.7 },
  { url: absoluteLearningUrl("/privacy-policy"), changeFrequency: "yearly", priority: 0.3 },
  { url: absoluteLearningUrl("/terms-of-service"), changeFrequency: "yearly", priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const supabase = await createClient();
    const courses: SitemapCourseRow[] = [];
    let offset = 0;

    while (true) {
      const { data, error } = await supabase.rpc("search_public_published_learning_courses", {
        p_query: null,
        p_category: null,
        p_level: null,
        p_is_free: null,
        p_sort: "newest",
        p_limit: 24,
        p_offset: offset,
      });
      if (error) throw error;

      const page = (data ?? []) as SitemapCourseRow[];
      courses.push(...page);
      if (page.length < 24) break;
      offset += page.length;
    }

    return [...staticPages, ...courses.map((course) => ({
      url: absoluteLearningUrl(`/courses/${encodeURIComponent(course.slug)}`),
      lastModified: course.published_at ? new Date(course.published_at) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }))];
  } catch {
    return staticPages;
  }
}
