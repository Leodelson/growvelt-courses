import Link from "next/link";
import { redirect } from "next/navigation";
import { getPendingLearningCourses } from "@/app/lib/admin/course-moderation";
import { isLearningAdmin } from "@/app/lib/admin/authorization";

export const metadata = { title: "Course reviews" };

export default async function AdminCourseQueuePage() {
  if (!await isLearningAdmin()) redirect("/dashboard");
  const courses = await getPendingLearningCourses();
  return <section className="admin-page section-shell"><header className="admin-page-header"><p className="eyebrow">Admin Operations</p><h1>Course reviews</h1><p>Review complete, submitted free courses before they become available in Growvelt Learning.</p></header>{courses.length ? <div className="admin-application-list">{courses.map((course) => <article className="admin-application-row" key={course.course_id}><div><p className="admin-status">Pending review</p><h2>{course.course_title}</h2><p>{course.instructor_name || "Instructor name unavailable"}{course.instructor_email ? ` · ${course.instructor_email}` : ""}</p><p>{course.category || "Uncategorized"} · {course.level || "Level not set"} · {course.is_free ? "Free" : `${course.price_currency || "NGN"} ${Number(course.price_amount ?? 0).toLocaleString("en-NG")}`}</p></div><div className="admin-row-meta"><time dateTime={course.submitted_at || undefined}>Submitted {course.submitted_at ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(course.submitted_at)) : "date unavailable"}</time><Link className="button button-secondary" href={`/dashboard/admin/courses/${course.course_id}`}>Review course<span className="sr-only"> {course.course_title}</span></Link></div></article>)}</div> : <section className="admin-empty-state"><p className="eyebrow">All caught up</p><h2>No submitted courses are waiting for review.</h2><p>Courses appear here only after an approved Instructor submits a complete draft.</p></section>}</section>;
}
