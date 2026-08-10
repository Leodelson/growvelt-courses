import { notFound, redirect } from "next/navigation";
import { CourseDraftForm } from "@/app/components/instructor/course-draft-form";
import { CourseStatusBadge } from "@/app/components/instructor/course-status-badge";
import { ProtectedPageHeader } from "@/app/components/protected-page-header";
import { isApprovedInstructor } from "@/app/lib/instructor/authorization";
import { getOwnInstructorCourse } from "@/app/lib/instructor/courses";

export const metadata = { title: "Edit course" };

export default async function InstructorCourseEditorPage({ params }: { params: Promise<{ courseId: string }> }) {
  if (!await isApprovedInstructor()) redirect("/teach/application");
  const { courseId } = await params;
  const id = Number(courseId);
  if (!Number.isSafeInteger(id) || id < 1) notFound();

  const course = await getOwnInstructorCourse(id);
  if (!course) notFound();

  const updatedAt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(course.updated_at));

  return <><ProtectedPageHeader context="Course editor" backHref="/instructor/courses" backLabel="Your courses" /><main id="main-content" className="course-editor-page section-shell"><header className="course-editor-heading"><div><p className="eyebrow">Course metadata</p><h1>{course.title}</h1><p>URL: <code>/{course.slug}</code></p></div><div className="course-editor-status"><CourseStatusBadge status={course.status} /><span>Updated {updatedAt}</span></div></header><CourseDraftForm mode="edit" courseId={course.course_id} status={course.status} initialValues={{ title: course.title, summary: course.summary ?? "", description: course.description ?? "", category: course.category ?? "Data Analytics", level: course.level ?? "Beginner", is_free: course.is_free, price_amount: course.price_amount, price_currency: course.price_currency }} /><aside className="course-editor-next"><p className="eyebrow">Coming next</p><h2>Curriculum and course review</h2><p>Modules, lessons, video references, and submission for Growvelt review are separate checkpoints. They are not created by this draft editor.</p></aside></main></>;
}
