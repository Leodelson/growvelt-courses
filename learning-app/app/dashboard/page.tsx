import { DashboardHome } from "@/app/components/learning/dashboard-home";
import {
  getActiveLearningEditorialCampaign,
  listPublicLearningSubjects,
  normalizePublicCatalogQuery,
  searchPublicPublishedLearningCourses,
} from "@/app/lib/catalog/published-courses";
import { getOwnSavedLearningCourseIds } from "@/app/lib/learning/saved-courses";
import { getRequestLocale } from "@/app/lib/i18n-server";

export const metadata = { title: "Learning home" };

export default async function DashboardPage() {
  const query = normalizePublicCatalogQuery({});
  const [campaign, savedCourseIds, locale, catalog] = await Promise.all([
    getActiveLearningEditorialCampaign(),
    getOwnSavedLearningCourseIds(),
    getRequestLocale(),
    searchPublicPublishedLearningCourses(query),
  ]);
  const subjects = await listPublicLearningSubjects(catalog, locale);
  return <DashboardHome campaign={campaign} catalog={catalog} query={query} savedCourseIds={savedCourseIds} locale={locale} subjects={subjects} />;
}
