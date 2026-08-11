import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseDraftForm } from "@/app/components/instructor/course-draft-form";
import { CourseStatusBadge } from "@/app/components/instructor/course-status-badge";
import { getOwnInstructorCourse } from "@/app/lib/instructor/courses";

export const metadata = { title: "Edit course" };

export default async function DashboardInstructorCourseEditorPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const id = Number(courseId);
  if (!Number.isSafeInteger(id) || id < 1) notFound();

  const course = await getOwnInstructorCourse(id);
  if (!course) notFound();

  const updatedAt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(course.updated_at));

  return <section className="course-editor-page section-shell"><header className="course-editor-heading"><div><p className="eyebrow">Course metadata</p><h1>{course.title}</h1><p>URL: <code>/{course.slug}</code></p></div><div className="course-editor-status"><CourseStatusBadge status={course.status} /><span>Updated {updatedAt}</span></div></header><CourseDraftForm mode="edit" courseId={course.course_id} status={course.status} initialValues={{ title: course.title, summary: course.summary ?? "", description: course.description ?? "", category: course.category ?? "Data Analytics", level: course.level ?? "Beginner", is_free: course.is_free, price_amount: course.price_amount, price_currency: course.price_currency }} /><aside className="course-editor-next"><p className="eyebrow">Course structure</p><h2>{course.status === "draft" ? "Build the curriculum" : "Curriculum is read-only"}</h2><p>{course.status === "draft" ? "Add modules and video or text lessons. Submission for Growvelt review remains a separate checkpoint." : "This course is not a draft, so its curriculum cannot be changed by the Instructor."}</p><Link className="button button-primary" href={`/dashboard/instructor/courses/${course.course_id}/curriculum`}>{course.status === "draft" ? "Edit curriculum" : "View curriculum"}</Link></aside></section>;
}
