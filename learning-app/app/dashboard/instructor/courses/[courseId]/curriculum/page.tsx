import Link from "next/link";
import { notFound } from "next/navigation";
import { CurriculumEditor } from "@/app/components/instructor/curriculum-editor";
import { CourseStatusBadge } from "@/app/components/instructor/course-status-badge";
import { getOwnInstructorCourse } from "@/app/lib/instructor/courses";
import { getOwnInstructorCurriculum } from "@/app/lib/instructor/curriculum";
import { getRequestLocale } from "@/app/lib/i18n-server";

export const metadata = { title: "Edit curriculum" };

export default async function CurriculumPage({ params }: { params: Promise<{ courseId: string }> }) {
  const [{ courseId }, locale] = await Promise.all([params, getRequestLocale()]);
  const id = Number(courseId);
  if (!Number.isSafeInteger(id) || id < 1) notFound();

  const course = await getOwnInstructorCourse(id);
  if (!course) notFound();
  const modules = await getOwnInstructorCurriculum(id);

  const text = locale === "fr" ? { title: "Modifier le programme", copy: "Organisez le brouillon en modules et leçons. La soumission et la publication du cours restent des étapes protégées distinctes.", overview: "Aperçu du cours" } : locale === "es" ? { title: "Editar el plan de estudios", copy: "Organiza el borrador en módulos y lecciones. El envío y la publicación del curso siguen siendo pasos protegidos separados.", overview: "Resumen del curso" } : { title: "Edit curriculum", copy: "Organize the draft into modules and lessons. Course submission and publishing are still separate, protected checkpoints.", overview: "Course overview" };
  return <section className="curriculum-page section-shell">
    <header className="course-editor-heading curriculum-page-heading">
      <div><p className="eyebrow">{course.title}</p><h1>{text.title}</h1><p>{text.copy}</p></div>
      <div className="course-editor-status"><CourseStatusBadge status={course.status} /><Link className="back-link" href={`/dashboard/instructor/courses/${course.course_id}`}>{text.overview}</Link></div>
    </header>
    <CurriculumEditor courseId={course.course_id} status={course.status} initialModules={modules} />
  </section>;
}
