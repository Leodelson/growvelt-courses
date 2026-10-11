import { PublicCatalog } from "@/app/components/public-catalog";
import { getActiveLearningEditorialCampaign, searchPublicPublishedLearningCourses } from "@/app/lib/catalog/published-courses";
import { normalizePublicCatalogQuery } from "@/app/lib/catalog/public-catalog-query";
import { getOwnSavedLearningCourseIds } from "@/app/lib/learning/saved-courses";

export const metadata = { title: "Explore catalog" };

export default async function DashboardExplorePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = normalizePublicCatalogQuery(await searchParams);
  const [catalog, campaign, savedCourseIds] = await Promise.all([searchPublicPublishedLearningCourses(query), getActiveLearningEditorialCampaign(), getOwnSavedLearningCourseIds()]);
  const catalogKey = `${query.query}|${query.category}|${query.level}|${query.access}|${query.sort}`;

  return <PublicCatalog key={catalogKey} catalog={catalog} query={query} authenticated savedCourseIds={savedCourseIds} basePath="/dashboard/explore" dashboard campaign={campaign} />;
}
