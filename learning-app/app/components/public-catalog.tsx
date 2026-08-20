"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PublishedCourseCard } from "@/app/components/published-course-card";
import { createClient } from "@/app/lib/supabase/browser";
import type { PublicCatalogResult, PublishedCourse } from "@/app/lib/catalog/published-courses";
import { PublicCatalogQuery, publicCatalogHref } from "@/app/lib/catalog/public-catalog-query";
import { useLanguage } from "@/app/components/language-provider";

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
  total_courses: number;
};

function toCourse(row: PublicCatalogCourseRow): PublishedCourse {
  return { id: row.course_id, slug: row.slug, title: row.title, summary: row.summary, category: row.category, level: row.level, isFree: row.is_free, priceAmount: row.price_amount, priceCurrency: row.price_currency, instructorName: row.instructor_name };
}

export function PublicCatalog({ catalog, query, authenticated, savedCourseIds = [], basePath = "/learn", dashboard = false }: { catalog: PublicCatalogResult; query: PublicCatalogQuery; authenticated: boolean; savedCourseIds?: number[]; basePath?: string; dashboard?: boolean }) {
  const { t } = useLanguage();
  const router = useRouter();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [typedQuery, setTypedQuery] = useState(query.query);
  const [courses, setCourses] = useState(catalog.courses);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const hasMore = courses.length < catalog.total;

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
    const { data, error } = await createClient().rpc("search_public_published_learning_courses", {
      p_query: query.query || null,
      p_category: query.category || null,
      p_level: query.level || null,
      p_is_free: query.access === "all" ? null : query.access === "free",
      p_sort: query.sort,
      p_limit: catalog.pageSize,
      p_offset: courses.length,
    });
    if (error) setLoadMoreError(true);
    else setCourses((current) => [...current, ...((data ?? []) as PublicCatalogCourseRow[]).map(toCourse)]);
    setIsLoadingMore(false);
  }, [catalog.pageSize, courses.length, hasMore, isLoadingMore, query.access, query.category, query.level, query.query, query.sort]);

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

  return <section className="catalog-page section-shell">
    <header className={dashboard ? "catalog-hero dashboard-catalog-hero" : "catalog-hero"}><p className="eyebrow">{t("catalog.eyebrow")}</p><h1>{t("catalog.title")}</h1><p>{dashboard ? t("catalog.dashboardCopy") : t("catalog.publicCopy")}</p></header>

    <div className="public-catalog-controls" aria-label={t("catalog.filters")}>
      <label className="public-catalog-search">{t("catalog.search")}<input name="q" type="search" value={typedQuery} placeholder={t("catalog.searchPlaceholder")} maxLength={120} onChange={(event) => setTypedQuery(event.target.value)} /></label>
      <label>{t("catalog.category")}<select value={query.category} onChange={(event) => updateQuery({ category: event.target.value })}><option value="">{t("catalog.allCategories")}</option>{categories.map((category) => <option value={category} key={category}>{category}</option>)}</select></label>
      <label>{t("catalog.level")}<select value={query.level} onChange={(event) => updateQuery({ level: event.target.value })}><option value="">{t("catalog.allLevels")}</option>{levels.map((level) => <option value={level} key={level}>{level}</option>)}</select></label>
      <label>{t("catalog.access")}<select value={query.access} onChange={(event) => updateQuery({ access: event.target.value as PublicCatalogQuery["access"] })}><option value="all">{t("catalog.allAccess")}</option><option value="free">{t("catalog.free")}</option><option value="paid">{t("catalog.paid")}</option></select></label>
      <label>{t("catalog.sort")}<select value={query.sort} onChange={(event) => updateQuery({ sort: event.target.value as PublicCatalogQuery["sort"] })}><option value="newest">{t("catalog.newest")}</option><option value="title_asc">{t("catalog.titleAsc")}</option><option value="title_desc">{t("catalog.titleDesc")}</option></select></label>
      <div className="public-catalog-actions"><Link className="button button-secondary" href={basePath}>{t("catalog.reset")}</Link></div>
    </div>

    {catalog.total === 0 ? <section className="course-empty-state catalog-empty-state"><p className="eyebrow">{t("catalog.noMatches")}</p><h2>{hasActiveFilters ? t("catalog.tryDifferent") : t("catalog.noCourses")}</h2><p>{hasActiveFilters ? t("catalog.clearFiltersCopy") : t("catalog.emptyCopy")}</p>{hasActiveFilters ? <Link className="button button-secondary" href={basePath}>{t("catalog.clearFilters")}</Link> : null}</section> : <section aria-labelledby="public-catalog-title">
      <div className="section-heading"><div><p className="eyebrow">{t("catalog.published")}</p><h2 id="public-catalog-title">{catalog.total} {catalog.total === 1 ? t("catalog.course") : t("catalog.courses")} {t("catalog.available")}</h2></div><p className="live-catalog-chip"><span aria-hidden="true" />{t("catalog.live")}</p></div>
      <div className="course-grid published-course-grid public-published-course-grid">{courses.map((course, index) => <PublishedCourseCard course={course} highlightQuery={query.query} href={courseHref(course.slug)} index={index} key={course.id} authenticated={authenticated} isSaved={savedCourseIds.includes(course.id)} />)}</div>
      <div className="public-catalog-load-more" ref={sentinelRef} aria-live="polite">{isLoadingMore ? <p><span className="catalog-loader" aria-hidden="true" />{t("catalog.loadingMore")}</p> : null}{loadMoreError ? <button className="button button-secondary" type="button" onClick={() => void loadMore()}>{t("catalog.tryLoading")}</button> : null}{!hasMore && !isLoadingMore && !loadMoreError ? <p className="results-end-marker">{t("catalog.end")}</p> : null}</div>
    </section>}
  </section>;
}
