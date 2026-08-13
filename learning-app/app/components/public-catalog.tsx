"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PublishedCourseCard } from "@/app/components/published-course-card";
import { createClient } from "@/app/lib/supabase/browser";
import type { PublicCatalogResult, PublishedCourse } from "@/app/lib/catalog/published-courses";
import { PublicCatalogQuery, publicCatalogHref } from "@/app/lib/catalog/public-catalog-query";

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

export function PublicCatalog({ catalog, query, authenticated, basePath = "/learn", dashboard = false }: { catalog: PublicCatalogResult; query: PublicCatalogQuery; authenticated: boolean; basePath?: string; dashboard?: boolean }) {
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

  const courseHref = (slug: string) => authenticated ? `/dashboard/courses/${encodeURIComponent(slug)}` : `/sign-up?next=${encodeURIComponent(`/dashboard/courses/${slug}`)}`;
  const hasActiveFilters = Boolean(query.query || query.category || query.level || query.access !== "all");

  return <section className="catalog-page section-shell">
    <header className={dashboard ? "catalog-hero dashboard-catalog-hero" : "catalog-hero"}><p className="eyebrow">Explore Growvelt Learning</p><h1>Find a practical course to begin.</h1><p>{dashboard ? "Search the live published catalog, compare practical courses, and add available free learning directly to your account." : "Browse live published courses from Growvelt Instructors. Free courses can be enrolled in after you sign in; paid-course checkout is not available yet."}</p></header>

    <div className="public-catalog-controls" aria-label="Course catalog filters">
      <label className="public-catalog-search">Search courses<input name="q" type="search" value={typedQuery} placeholder="Search title, topic, or category" maxLength={120} onChange={(event) => setTypedQuery(event.target.value)} /></label>
      <label>Category<select value={query.category} onChange={(event) => updateQuery({ category: event.target.value })}><option value="">All categories</option>{categories.map((category) => <option value={category} key={category}>{category}</option>)}</select></label>
      <label>Level<select value={query.level} onChange={(event) => updateQuery({ level: event.target.value })}><option value="">All levels</option>{levels.map((level) => <option value={level} key={level}>{level}</option>)}</select></label>
      <label>Access<select value={query.access} onChange={(event) => updateQuery({ access: event.target.value as PublicCatalogQuery["access"] })}><option value="all">All access</option><option value="free">Free</option><option value="paid">Paid</option></select></label>
      <label>Sort<select value={query.sort} onChange={(event) => updateQuery({ sort: event.target.value as PublicCatalogQuery["sort"] })}><option value="newest">Newest</option><option value="title_asc">Title: A-Z</option><option value="title_desc">Title: Z-A</option></select></label>
      <div className="public-catalog-actions"><Link className="button button-secondary" href={basePath}>Reset</Link></div>
    </div>

    {catalog.total === 0 ? <section className="course-empty-state catalog-empty-state"><p className="eyebrow">No matching courses</p><h2>{hasActiveFilters ? "Try a different search or filter." : "Published courses will appear here as they become available."}</h2><p>{hasActiveFilters ? "Clear one or more filters to see the current published catalog." : "Growvelt is preparing practical learning experiences for this catalog."}</p>{hasActiveFilters ? <Link className="button button-secondary" href={basePath}>Clear filters</Link> : null}</section> : <section aria-labelledby="public-catalog-title">
      <div className="section-heading"><div><p className="eyebrow">Published courses</p><h2 id="public-catalog-title">{catalog.total} {catalog.total === 1 ? "course" : "courses"} available</h2></div><p className="live-catalog-chip"><span aria-hidden="true" />Live catalog</p></div>
      <div className="course-grid published-course-grid public-published-course-grid">{courses.map((course, index) => <PublishedCourseCard course={course} highlightQuery={query.query} href={courseHref(course.slug)} index={index} key={course.id} />)}</div>
      <div className="public-catalog-load-more" ref={sentinelRef} aria-live="polite">{isLoadingMore ? <p><span className="catalog-loader" aria-hidden="true" />Loading more courses</p> : null}{loadMoreError ? <button className="button button-secondary" type="button" onClick={() => void loadMore()}>Try loading more</button> : null}{!hasMore && !isLoadingMore && !loadMoreError ? <p className="results-end-marker">End of course catalog</p> : null}</div>
    </section>}
  </section>;
}
