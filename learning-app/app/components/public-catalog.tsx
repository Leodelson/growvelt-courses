"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PublishedCourseCard } from "@/app/components/published-course-card";
import { FeaturedLearningCampaign } from "@/app/components/featured-learning-campaign";
import { createClient } from "@/app/lib/supabase/browser";
import type { ActiveLearningCampaign, PublicCatalogResult, PublishedCourse } from "@/app/lib/catalog/published-courses";
import { PublicCatalogQuery, publicCatalogHref } from "@/app/lib/catalog/public-catalog-query";
import { useLanguage } from "@/app/components/language-provider";
import { EmptyState } from "@/app/components/ui/empty-state";
import { publicExperienceCopy } from "@/app/lib/public-experience-copy";
import styles from "./public-catalog.module.css";
import { CourseShelf } from "./course-shelf";
import { withCourseRatings } from "@/app/lib/catalog/course-ratings";
import { coursePresentationCopy } from "@/app/lib/catalog/course-presentation-copy";
import { LearningPathExplorer } from "./learning-path-explorer";

const categories = ["Business", "Business Intelligence", "Creative Skills", "Cybersecurity", "Data Analytics", "Data Science", "Digital Marketing", "Digital Skills", "Productivity", "Programming", "Web Development"];
const levels = ["Beginner", "Intermediate", "Beginner to intermediate", "Beginner to job-ready"];

type PublicCatalogCourseRow = {
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
  provider_name: string | null;
  provider_slug: string | null;
  provider_verified: boolean;
  total_courses: number;
};

function toCourse(row: PublicCatalogCourseRow): PublishedCourse {
  return { id: row.course_id, slug: row.slug, title: row.title, summary: row.summary, category: row.category, level: row.level, isFree: row.is_free, priceAmount: row.price_amount, priceCurrency: row.price_currency, instructorName: row.instructor_name, providerName: row.provider_name, providerSlug: row.provider_slug, providerVerified: row.provider_verified };
}

export function PublicCatalog({ catalog, query, authenticated, savedCourseIds = [], basePath = "/learn", dashboard = false, campaign = null }: { catalog: PublicCatalogResult; query: PublicCatalogQuery; authenticated: boolean; savedCourseIds?: number[]; basePath?: string; dashboard?: boolean; campaign?: ActiveLearningCampaign | null }) {
  const { t, locale } = useLanguage();
  const copy = publicExperienceCopy[locale].catalog;
  const router = useRouter();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [typedQuery, setTypedQuery] = useState(query.query);
  const [courses, setCourses] = useState(catalog.courses);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const hasMore = (query.page - 1) * catalog.pageSize + courses.length < catalog.total;

  const updateQuery = useCallback((changes: Partial<PublicCatalogQuery>) => {
    router.replace(publicCatalogHref({ ...query, page: 1 }, changes, basePath), { scroll: false });
  }, [basePath, query, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (typedQuery !== query.query) updateQuery({ query: typedQuery.trim().slice(0, 120) });
    }, 280);
    return () => window.clearTimeout(timer);
  }, [typedQuery, query.query, updateQuery]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    setLoadMoreError(false);
    try {
    const { data, error } = await createClient().rpc("search_public_published_learning_courses", {
      p_query: query.query || null,
      p_category: query.category || null,
      p_level: query.level || null,
      p_is_free: query.access === "all" ? null : query.access === "free",
      p_sort: query.sort,
      p_limit: catalog.pageSize,
      p_offset: (query.page - 1) * catalog.pageSize + courses.length,
    });
    if (error) setLoadMoreError(true);
    else { const next = await withCourseRatings(createClient(), ((data ?? []) as PublicCatalogCourseRow[]).map(toCourse)); setCourses((current) => [...current, ...next.filter((item) => !current.some((existing) => existing.id === item.id))]); }
    } catch { setLoadMoreError(true); }
    finally { setIsLoadingMore(false); }
  }, [catalog.pageSize, courses.length, hasMore, isLoadingMore, query.access, query.category, query.level, query.query, query.sort, query.page]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadMore();
    }, { rootMargin: "240px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const courseHref = (slug: string) => `${dashboard ? "/dashboard/courses" : "/courses"}/${encodeURIComponent(slug)}`;
  const hasActiveFilters = Boolean(query.query || query.category || query.level || query.access !== "all");
  const groups = new Map<string, PublishedCourse[]>();
  for (const course of courses) { const topic = course.category || t("catalog.fallbackCategory"); groups.set(topic, [...(groups.get(topic) ?? []), course]); }
  const shelves = [...groups].filter(([, items]) => items.length > 1);
  const remaining = [...groups.values()].filter((items) => items.length === 1).flat();
  if (remaining.length) shelves.push([coursePresentationCopy[locale].more, remaining]);

  return <section className={`${styles.page} ${dashboard ? styles.dashboard : ""}`}>
    <header className={styles.hero}><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p>{copy.intro}</p><div className={styles.topics} aria-label="Browse by subject">{categories.slice(0, 6).map((category) => <Link key={category} href={publicCatalogHref({ ...query, page: 1 }, { category }, basePath)} aria-current={query.category === category ? "page" : undefined}>{category}<span aria-hidden="true"> ↗</span></Link>)}</div></header>

    {!hasActiveFilters && query.page === 1 ? <LearningPathExplorer basePath={basePath} /> : null}

    {campaign && query.page === 1 && !hasActiveFilters ? <FeaturedLearningCampaign campaign={campaign} authenticated={authenticated} savedCourseIds={savedCourseIds} dashboard={dashboard} /> : null}

    <div className={styles.filterHeading}><h2>{copy.filters}</h2>{hasActiveFilters ? <Link href={basePath}>{copy.reset}<span aria-hidden="true"> ↗</span></Link> : null}</div>
    <div className={styles.controls} aria-label={t("catalog.filters")}>
      {dashboard ? <label className={styles.search}>{t("catalog.search")}<input name="q" type="search" value={typedQuery} placeholder={t("catalog.searchPlaceholder")} maxLength={120} onChange={(event) => setTypedQuery(event.target.value)} /></label> : null}
      <label>{t("catalog.category")}<select value={query.category} onChange={(event) => updateQuery({ category: event.target.value })}><option value="">{t("catalog.allCategories")}</option>{categories.map((category) => <option value={category} key={category}>{category}</option>)}</select></label>
      <label>{t("catalog.level")}<select value={query.level} onChange={(event) => updateQuery({ level: event.target.value })}><option value="">{t("catalog.allLevels")}</option>{levels.map((level) => <option value={level} key={level}>{level}</option>)}</select></label>
      <label>{t("catalog.access")}<select value={query.access} onChange={(event) => updateQuery({ access: event.target.value as PublicCatalogQuery["access"] })}><option value="all">{t("catalog.allAccess")}</option><option value="free">{t("catalog.free")}</option><option value="paid">{t("catalog.paid")}</option></select></label>
      <label>{t("catalog.sort")}<select value={query.sort} onChange={(event) => updateQuery({ sort: event.target.value as PublicCatalogQuery["sort"] })}><option value="newest">{t("catalog.newest")}</option><option value="title_asc">{t("catalog.titleAsc")}</option><option value="title_desc">{t("catalog.titleDesc")}</option></select></label>
      {dashboard && hasActiveFilters ? <Link className={styles.reset} href={basePath}>{t("catalog.reset")}</Link> : null}
    </div>

    {!dashboard && query.query ? <p className={styles.query}>{copy.query} <strong>“{query.query}”</strong></p> : null}

    {catalog.total === 0 ? dashboard ? <section className="course-empty-state catalog-empty-state"><p className="eyebrow">{t("catalog.noMatches")}</p><h2>{hasActiveFilters ? t("catalog.tryDifferent") : t("catalog.noCourses")}</h2><p>{hasActiveFilters ? t("catalog.clearFiltersCopy") : t("catalog.emptyCopy")}</p>{hasActiveFilters ? <Link className="button button-secondary" href={basePath}>{t("catalog.clearFilters")}</Link> : null}</section> : <EmptyState titleId="catalog-empty-title" icon="explore" eyebrow={t("catalog.noMatches")} title={hasActiveFilters ? t("catalog.tryDifferent") : t("catalog.noCourses")} description={hasActiveFilters ? t("catalog.clearFiltersCopy") : t("catalog.emptyCopy")} /> : <section aria-labelledby="public-catalog-title">
      <div className={styles.resultsHeading}><div><p className="eyebrow">{t("catalog.published")}</p><h2 id="public-catalog-title">{catalog.total} {catalog.total === 1 ? t("catalog.course") : t("catalog.courses")} {t("catalog.available")}</h2></div><p className="live-catalog-chip"><span aria-hidden="true" />{t("catalog.live")}</p></div>
      {!hasActiveFilters && query.sort === "newest" ? shelves.map(([topic, items]) => <CourseShelf key={topic} title={topic} courses={items} dashboard={dashboard} authenticated={authenticated} savedCourseIds={savedCourseIds} />) : <div className={styles.grid}>{courses.map((course, index) => <PublishedCourseCard course={course} highlightQuery={query.query} href={courseHref(course.slug)} index={index} key={course.id} authenticated={authenticated} isSaved={savedCourseIds.includes(course.id)} />)}</div>}
      <div className="public-catalog-load-more" ref={sentinelRef} aria-live="polite">{isLoadingMore ? <p><span className="catalog-loader" aria-hidden="true" />{t("catalog.loadingMore")}</p> : null}{loadMoreError ? <button className="button button-secondary" type="button" onClick={() => void loadMore()}>{t("catalog.tryLoading")}</button> : null}{!hasMore && !isLoadingMore && !loadMoreError ? <p className="results-end-marker">{t("catalog.end")}</p> : null}</div>
    </section>}
  </section>;
}
