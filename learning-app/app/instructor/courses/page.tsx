import Link from "next/link";
import { redirect } from "next/navigation";
import { CourseStatusBadge } from "@/app/components/instructor/course-status-badge";
import { ProtectedPageHeader } from "@/app/components/protected-page-header";
import { getOwnInstructorCourses } from "@/app/lib/instructor/courses";
import { isApprovedInstructor } from "@/app/lib/instructor/authorization";

export const metadata = { title: "Your courses" };

export default async function InstructorCoursesPage() {
  if (!await isApprovedInstructor()) redirect("/teach/application");
  const courses = await getOwnInstructorCourses();

  return <><ProtectedPageHeader context="Course management" backHref="/instructor" backLabel="Instructor workspace" /><main id="main-content" className="course-management-page section-shell"><header className="course-management-heading"><div><p className="eyebrow">Instructor workspace</p><h1>Your courses</h1><p>Create and refine private course drafts. Curriculum, submission, and publishing are introduced in later phases.</p></div><Link className="button button-primary" href="/instructor/courses/new">Create course</Link></header>{courses.length ? <section className="instructor-course-list" aria-label="Your courses">{courses.map((course) => <article className="instructor-course-row" key={course.course_id}><div><div className="course-row-meta"><CourseStatusBadge status={course.status} /><span>{course.category || "Uncategorized"}</span><span>{course.level || "Level not set"}</span></div><h2>{course.title}</h2><p>{course.summary || "No summary added yet."}</p></div><div className="course-row-actions"><span>{course.is_free ? "Free" : `${course.price_currency || "NGN"} ${Number(course.price_amount ?? 0).toLocaleString("en-NG")}`}</span><Link className="button button-secondary" href={`/instructor/courses/${course.course_id}`}>{course.status === "draft" ? "Edit draft" : "View course"}</Link></div></article>)}</section> : <section className="course-empty-state"><p className="eyebrow">Your first course</p><h2>Start with a clear course idea.</h2><p>Build private draft metadata first. Curriculum, submission, and publishing are intentionally not available yet.</p><Link className="button button-primary" href="/instructor/courses/new">Create your first draft</Link></section>}</main></>;
}
