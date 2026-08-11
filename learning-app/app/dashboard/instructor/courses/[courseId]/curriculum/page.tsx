import Link from "next/link";
import { notFound } from "next/navigation";
import { CurriculumEditor } from "@/app/components/instructor/curriculum-editor";
import { CourseStatusBadge } from "@/app/components/instructor/course-status-badge";
import { getOwnInstructorCourse } from "@/app/lib/instructor/courses";
import { getOwnInstructorCurriculum } from "@/app/lib/instructor/curriculum";

export const metadata = { title: "Edit curriculum" };

export default async function CurriculumPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const id = Number(courseId);
  if (!Number.isSafeInteger(id) || id < 1) notFound();

  const course = await getOwnInstructorCourse(id);
  if (!course) notFound();
  const modules = await getOwnInstructorCurriculum(id);

  return <section className="curriculum-page section-shell">
    <header className="course-editor-heading curriculum-page-heading">
      <div><p className="eyebrow">{course.title}</p><h1>Edit curriculum</h1><p>Organize the draft into modules and lessons. Course submission and publishing are still separate, protected checkpoints.</p></div>
      <div className="course-editor-status"><CourseStatusBadge status={course.status} /><Link className="back-link" href={`/dashboard/instructor/courses/${course.course_id}`}>Course overview</Link></div>
    </header>
    <CurriculumEditor courseId={course.course_id} status={course.status} initialModules={modules} />
  </section>;
}
