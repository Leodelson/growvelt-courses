import { PublicCatalog } from "@/app/components/public-catalog";
import { PublicHeader } from "@/app/components/public-header";
import { searchPublicPublishedLearningCourses } from "@/app/lib/catalog/published-courses";
import { normalizePublicCatalogQuery } from "@/app/lib/catalog/public-catalog-query";
import { createClient } from "@/app/lib/supabase/server";

export const metadata = { title: "Explore courses" };

export default async function LearnPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = normalizePublicCatalogQuery(await searchParams);
  const [catalog, auth] = await Promise.all([
    searchPublicPublishedLearningCourses(query),
    (await createClient()).auth.getUser(),
  ]);

  const catalogKey = `${query.query}|${query.category}|${query.level}|${query.access}|${query.sort}`;
  return <div className="public-page"><PublicHeader /><main><PublicCatalog key={catalogKey} catalog={catalog} query={query} authenticated={Boolean(auth.data.user)} /></main></div>;
}
