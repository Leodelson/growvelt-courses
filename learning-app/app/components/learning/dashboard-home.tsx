import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CourseShelf } from "@/app/components/course-shelf";
import Footer from "@/app/components/Footer";
import { PublicCatalog } from "@/app/components/public-catalog";
import type { ActiveLearningCampaign, PublicCatalogResult } from "@/app/lib/catalog/published-courses";
import { publicCatalogHref, type PublicCatalogQuery } from "@/app/lib/catalog/public-catalog-query";
import type { Locale } from "@/app/lib/i18n";
import { DashboardSpotlightArt } from "./dashboard-spotlight-art";
import { dashboardHomeCopy } from "./dashboard-home-copy";
import styles from "./dashboard-home.module.css";

const explorePath = "/dashboard/explore";

export function DashboardHome({ campaign, catalog, query, savedCourseIds, locale }: {
  campaign: ActiveLearningCampaign | null;
  catalog: PublicCatalogResult;
  query: PublicCatalogQuery;
  savedCourseIds: number[];
  locale: Locale;
}) {
  const copy = dashboardHomeCopy[locale];
  const featured = campaign?.courses ?? [];
  const subjects = [...new Set([...featured, ...catalog.courses].flatMap((course) => course.category ? [course.category] : []))];
  const dataHref = publicCatalogHref(query, { category: "Data Analytics" }, explorePath);
  const hasDataCourses = subjects.includes("Data Analytics");
  const featureHref = featured[0] ? `/dashboard/courses/${encodeURIComponent(featured[0].slug)}` : hasDataCourses ? dataHref : explorePath;

  return (
    <div className={styles.page}>
      <header className={styles.spotlight}>
        <div className={styles.spotlightContent}>
          <p className="eyebrow">{campaign ? copy.featured : hasDataCourses ? copy.dataTopic : copy.eyebrow}</p>
          <h1>{campaign?.title ?? (hasDataCourses ? copy.dataTitle : copy.title)}</h1>
          <p>{campaign?.message ?? (hasDataCourses ? copy.dataIntro : copy.intro)}</p>
          <Link className="button button-primary" href={featureHref}>
            {featured[0] ? copy.viewCourse : hasDataCourses ? copy.browseData : copy.browseCatalog}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <DashboardSpotlightArt locale={locale} />
      </header>

      {featured.length > 0 && (
        <CourseShelf title={copy.featured} courses={featured} dashboard authenticated savedCourseIds={savedCourseIds} />
      )}
      {subjects.length > 1 && (
        <section className={styles.subjects} aria-labelledby="home-subjects">
          <h2 id="home-subjects">{copy.browseSubjects}</h2>
          <ul>
            {subjects.slice(0, 6).map((subject) => (
              <li key={subject}>
                <Link href={publicCatalogHref(query, { category: subject }, explorePath)}>
                  {subject} <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <PublicCatalog catalog={catalog} query={query} authenticated savedCourseIds={savedCourseIds} dashboard basePath={explorePath}
        homeFeed={{ title: copy.moreCourses, catalogLabel: copy.browseCatalog, excludedIds: featured.map(({ id }) => id) }} />
      <Footer />
    </div>
  );
}
