import type { Metadata } from "next";
import { PublicCatalog } from "@/app/components/public-catalog";
import { PublicHeader } from "@/app/components/public-header";
import { searchPublicPublishedLearningCourses } from "@/app/lib/catalog/published-courses";
import { normalizePublicCatalogQuery } from "@/app/lib/catalog/public-catalog-query";
import { createClient } from "@/app/lib/supabase/server";
import { getOwnSavedLearningCourseIds } from "@/app/lib/learning/saved-courses";

export const metadata: Metadata = {
  title: "Explore practical courses",
  description: "Browse live Growvelt Learning courses in data, technology, business, and practical career skills.",
  alternates: { canonical: "/learn" },
  openGraph: { url: "/learn", title: "Explore practical courses | Growvelt Learning" },
};

export default async function LearnPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = normalizePublicCatalogQuery(await searchParams);
  const [catalog, auth] = await Promise.all([
    searchPublicPublishedLearningCourses(query),
    (await createClient()).auth.getUser(),
  ]);

  const savedCourseIds = auth.data.user ? await getOwnSavedLearningCourseIds() : [];
  const catalogKey = `${query.query}|${query.category}|${query.level}|${query.access}|${query.sort}`;
  return <div className="public-page"><PublicHeader /><main><PublicCatalog key={catalogKey} catalog={catalog} query={query} authenticated={Boolean(auth.data.user)} savedCourseIds={savedCourseIds} /></main></div>;
}
