import Link from "next/link";
import { redirect } from "next/navigation";
import { OperationsSearchControls } from "@/app/components/operations-search-controls";
import { SearchHighlight } from "@/app/components/search-highlight";
import { searchPendingLearningCourses } from "@/app/lib/admin/course-moderation";
import { isLearningAdmin } from "@/app/lib/admin/authorization";
import { normalizeOperationsQuery, operationsHref } from "@/app/lib/operations-query";

export const metadata = { title: "Course reviews" };

export default async function AdminCourseQueuePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!await isLearningAdmin()) redirect("/dashboard");
  const query = normalizeOperationsQuery(await searchParams);
  const { courses, total, page, pageSize } = await searchPendingLearningCourses(query.query, query.category, query.level, query.page);
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  return <section className="admin-page admin-course-queue section-shell"><header className="admin-page-header admin-review-hero"><p className="eyebrow">Admin Operations</p><h1>Course reviews</h1><p>Inspect submitted course content, rights declarations, and secure quiz structures before publishing them for Growvelt learners.</p><div className="admin-review-summary"><span><strong>{total}</strong> awaiting review</span><span>Page {page} of {lastPage}</span></div></header>
    <OperationsSearchControls basePath="/dashboard/admin/courses" query={query} fields={[
      { name: "query", label: "Search reviews", placeholder: "Course, Instructor, category, or level" },
      { name: "category", label: "Category", placeholder: "Any category" },
      { name: "level", label: "Level", placeholder: "Any level" },
    ]} />
    {courses.length ? <><div className="admin-application-list admin-course-review-list">{courses.map((course) => <article className="admin-application-row admin-course-review-row" key={course.course_id}><div><p className="admin-status">Pending review</p><h2><SearchHighlight text={course.course_title} query={query.query} /></h2><p className="admin-course-instructor">By <SearchHighlight text={course.instructor_name || "Instructor name unavailable"} query={query.query} />{course.instructor_email ? <> · <SearchHighlight text={course.instructor_email} query={query.query} /></> : ""}</p><div className="admin-course-meta"><span><SearchHighlight text={course.category || "Uncategorized"} query={query.query} /></span><span><SearchHighlight text={course.level || "Level not set"} query={query.query} /></span><span>{course.is_free ? "Free" : `${course.price_currency || "NGN"} ${Number(course.price_amount ?? 0).toLocaleString("en-NG")}`}</span></div></div><div className="admin-row-meta"><time dateTime={course.submitted_at || undefined}>Submitted {course.submitted_at ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(course.submitted_at)) : "date unavailable"}</time><Link className="button button-secondary" href={`/dashboard/admin/courses/${course.course_id}`}>Review course <span aria-hidden="true">→</span><span className="sr-only"> {course.course_title}</span></Link></div></article>)}</div><nav className="operations-pagination" aria-label="Course review pages">{page > 1 && <Link className="button button-secondary" href={operationsHref("/dashboard/admin/courses", query, { page: page - 1 })}>Previous</Link>}{page < lastPage && <Link className="button button-secondary" href={operationsHref("/dashboard/admin/courses", query, { page: page + 1 })}>Next</Link>}</nav><div className="results-end-marker admin-review-end-marker">{page === lastPage ? "End of Course Reviews" : `Showing ${courses.length} of ${total} reviews`}</div></> : <section className="admin-empty-state admin-course-review-empty"><p className="eyebrow">{query.query || query.category || query.level ? "No matching reviews" : "All caught up"}</p><h2>{query.query || query.category || query.level ? "Try a different search or filter." : "No submitted courses are waiting for review."}</h2><p>{query.query || query.category || query.level ? "Clear one or more filters to return to the full pending-review queue." : "Courses appear here only after an approved Instructor submits a complete draft."}</p>{query.query || query.category || query.level ? <Link className="button button-secondary" href="/dashboard/admin/courses">Clear filters</Link> : null}</section>}</section>;
}
