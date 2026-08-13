import Link from "next/link";
import { CourseStatusBadge } from "@/app/components/instructor/course-status-badge";
import { getOwnInstructorCourses } from "@/app/lib/instructor/courses";

export const metadata = { title: "Your courses" };

export default async function DashboardInstructorCoursesPage() {
  const courses = await getOwnInstructorCourses();

  const draftCount = courses.filter((course) => course.status === "draft").length;
  const reviewCount = courses.filter((course) => course.status === "pending_review").length;
  const publishedCount = courses.filter((course) => course.status === "published").length;

  return <section className="course-management-page section-shell"><header className="course-management-heading"><div><p className="eyebrow">Instructor workspace</p><h1>Your courses</h1><p>Create structured lessons and quizzes, submit complete drafts for review, and follow each course through its publishing lifecycle.</p></div><Link className="button button-primary" href="/dashboard/instructor/courses/new">Create course</Link></header>{courses.length ? <><div className="instructor-course-summary" aria-label="Course status summary"><span><strong>{courses.length}</strong> total</span><span><strong>{draftCount}</strong> drafts</span><span><strong>{reviewCount}</strong> in review</span><span><strong>{publishedCount}</strong> published</span></div><section className="instructor-course-list" aria-label="Your courses">{courses.map((course) => <article className="instructor-course-row" key={course.course_id}><div><div className="course-row-meta"><CourseStatusBadge status={course.status} /><span>{course.category || "Uncategorized"}</span><span>{course.level || "Level not set"}</span></div><h2>{course.title}</h2><p>{course.summary || "No summary added yet."}</p></div><div className="course-row-actions"><span>{course.is_free ? "Free" : `${course.price_currency || "NGN"} ${Number(course.price_amount ?? 0).toLocaleString("en-NG")}`}</span><Link className="button button-secondary" href={`/dashboard/instructor/courses/${course.course_id}`}>{course.status === "draft" ? "Edit draft" : "View course"}</Link></div></article>)}</section><div className="results-end-marker instructor-courses-end-marker">End of My Courses</div></> : <section className="course-empty-state instructor-course-empty"><p className="eyebrow">Your first course</p><h2>Start with a clear course idea.</h2><p>Create the course details, build modules with text, video, and quiz activities, then submit the finished draft for Growvelt review.</p><Link className="button button-primary" href="/dashboard/instructor/courses/new">Create your first draft</Link></section>}</section>;
}
