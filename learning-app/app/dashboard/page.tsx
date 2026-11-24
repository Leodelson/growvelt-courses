import { DashboardHome } from "@/app/components/learning/dashboard-home";
import { getActiveLearningEditorialCampaign, normalizePublicCatalogQuery, searchPublicPublishedLearningCourses } from "@/app/lib/catalog/published-courses";
import { getOwnSavedLearningCourseIds } from "@/app/lib/learning/saved-courses";
import { getRequestLocale } from "@/app/lib/i18n-server";

export const metadata = { title: "Learning home" };

export default async function DashboardPage() {
  const [campaign, savedCourseIds, locale] = await Promise.all([
    getActiveLearningEditorialCampaign(),
    getOwnSavedLearningCourseIds(),
    getRequestLocale(),
  ]);
  const catalogCourses = campaign
    ? []
    : (await searchPublicPublishedLearningCourses(normalizePublicCatalogQuery({}))).courses;
  return <DashboardHome campaign={campaign} courses={catalogCourses} savedCourseIds={savedCourseIds} locale={locale} />;
}
