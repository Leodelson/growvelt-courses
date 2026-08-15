import Link from "next/link";
import { CourseStatusBadge } from "@/app/components/instructor/course-status-badge";
import { OperationsSearchControls } from "@/app/components/operations-search-controls";
import { SearchHighlight } from "@/app/components/search-highlight";
import { searchOwnInstructorCourses } from "@/app/lib/instructor/courses";
import { normalizeOperationsQuery, operationsHref } from "@/app/lib/operations-query";

export const metadata = { title: "Your courses" };

export default async function DashboardInstructorCoursesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = normalizeOperationsQuery(await searchParams);
  const result = await searchOwnInstructorCourses(query.query, query.status, query.page);
  const { courses, total, page, pageSize } = result;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="course-management-page section-shell">
      <header className="course-management-heading">
        <div>
          <p className="eyebrow">Instructor workspace</p>
          <h1>Your courses</h1>
          <p>Create structured lessons and quizzes, submit complete drafts for review, and follow each course through its publishing lifecycle.</p>
        </div>
        <Link className="button button-primary" href="/dashboard/instructor/courses/new">Create course</Link>
      </header>
      <OperationsSearchControls basePath="/dashboard/instructor/courses" query={query} fields={[
        { name: "query", label: "Search your courses", placeholder: "Title, topic, category, or level" },
        { name: "status", label: "Status", options: [{ value: "", label: "All statuses" }, { value: "draft", label: "Draft" }, { value: "pending_review", label: "Pending review" }, { value: "published", label: "Published" }, { value: "archived", label: "Archived" }] },
      ]} />
      {courses.length ? <>
        <div className="instructor-course-summary" aria-label="Course search result summary"><span><strong>{total}</strong> matching {total === 1 ? "course" : "courses"}</span><span>Page {page} of {lastPage}</span></div>
        <section className="instructor-course-list" aria-label="Your courses">
          {courses.map((course) => <article className="instructor-course-row" key={course.course_id}>
            <div><div className="course-row-meta"><CourseStatusBadge status={course.status} /><span><SearchHighlight text={course.category || "Uncategorized"} query={query.query} /></span><span><SearchHighlight text={course.level || "Level not set"} query={query.query} /></span></div><h2><SearchHighlight text={course.title} query={query.query} /></h2><p><SearchHighlight text={course.summary || "No summary added yet."} query={query.query} /></p></div>
            <div className="course-row-actions"><span>{course.is_free ? "Free" : `${course.price_currency || "NGN"} ${Number(course.price_amount ?? 0).toLocaleString("en-NG")}`}</span><Link className="button button-secondary" href={`/dashboard/instructor/courses/${course.course_id}`}>{course.status === "draft" ? "Edit draft" : "View course"}</Link></div>
          </article>)}
        </section>
        <nav className="operations-pagination" aria-label="Course results pages">
          {page > 1 && <Link className="button button-secondary" href={operationsHref("/dashboard/instructor/courses", query, { page: page - 1 })}>Previous</Link>}
          {page < lastPage && <Link className="button button-secondary" href={operationsHref("/dashboard/instructor/courses", query, { page: page + 1 })}>Next</Link>}
        </nav>
        <div className="results-end-marker instructor-courses-end-marker">{page === lastPage ? "End of My Courses" : `Showing ${courses.length} of ${total} courses`}</div>
      </> : <section className="course-empty-state instructor-course-empty">
        <p className="eyebrow">{query.query || query.status ? "No matching courses" : "Your first course"}</p>
        <h2>{query.query || query.status ? "Try a different search or filter." : "Start with a clear course idea."}</h2>
        <p>{query.query || query.status ? "Clear your search or status filter to see every course in your workspace." : "Create the course details, build modules with text, video, and quiz activities, then submit the finished draft for Growvelt review."}</p>
        {query.query || query.status ? <Link className="button button-secondary" href="/dashboard/instructor/courses">Clear filters</Link> : <Link className="button button-primary" href="/dashboard/instructor/courses/new">Create your first draft</Link>}
      </section>}
    </section>
  );
}
