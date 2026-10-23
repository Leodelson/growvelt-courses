import type { Metadata } from "next";
import { PublicCatalog } from "@/app/components/public-catalog";
import { PublicHeader } from "@/app/components/public-header";
import { getActiveLearningEditorialCampaign, searchPublicPublishedLearningCourses } from "@/app/lib/catalog/published-courses";
import { normalizePublicCatalogQuery } from "@/app/lib/catalog/public-catalog-query";
import { createClient } from "@/app/lib/supabase/server";
import { getOwnSavedLearningCourseIds } from "@/app/lib/learning/saved-courses";
import FooterWrapper from "@/app/components/FooterWrapper";
import styles from "@/app/components/public/public-experience.module.css";

export const metadata: Metadata = {
  title: "Explore practical courses",
  description: "Explore Growvelt online courses in data analytics, technology, business, and other practical skills. Compare course details and find a learning path that fits your goals.",
  alternates: { canonical: "/learn" },
  openGraph: {
    url: "/learn",
    title: "Explore online courses | Growvelt",
    description: "Browse practical online courses in data analytics, technology, business, and more. Find a course that fits your goals.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Explore online courses | Growvelt",
    description: "Browse practical online courses in data analytics, technology, business, and more. Find a course that fits your goals.",
  },
};

export default async function LearnPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = normalizePublicCatalogQuery(await searchParams);
  const [catalog, campaign, auth] = await Promise.all([
    searchPublicPublishedLearningCourses(query),
    getActiveLearningEditorialCampaign(),
    (await createClient()).auth.getUser(),
  ]);

  const savedCourseIds = auth.data.user ? await getOwnSavedLearningCourseIds() : [];
  const catalogKey = `${query.query}|${query.category}|${query.level}|${query.access}|${query.sort}`;
  return <div className={styles.publicPage}><PublicHeader initialQuery={query.query} /><main id="public-main"><PublicCatalog key={catalogKey} catalog={catalog} query={query} authenticated={Boolean(auth.data.user)} savedCourseIds={savedCourseIds} campaign={campaign} /></main><FooterWrapper /></div>;
}
