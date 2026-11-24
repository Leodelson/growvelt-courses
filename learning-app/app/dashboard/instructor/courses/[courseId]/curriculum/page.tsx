import Link from "next/link";
import { notFound } from "next/navigation";
import { CurriculumEditor } from "@/app/components/instructor/curriculum-editor";
import { CourseStatusBadge } from "@/app/components/instructor/course-status-badge";
import { getOwnInstructorCourse } from "@/app/lib/instructor/courses";
import { getOwnInstructorCurriculum } from "@/app/lib/instructor/curriculum";
import { getRequestLocale } from "@/app/lib/i18n-server";

import { CourseWorkflow, CurriculumSnapshot } from "@/app/components/instructor/authoring-tools";
import styles from "@/app/components/instructor/workbench.module.css";

export const metadata = { title: "Edit curriculum" };

export default async function CurriculumPage({ params }: { params: Promise<{ courseId: string }> }) {
  const [{ courseId }, locale] = await Promise.all([params, getRequestLocale()]);
  const id = Number(courseId);
  if (!Number.isSafeInteger(id) || id < 1) notFound();

  const course = await getOwnInstructorCourse(id);
  if (!course) notFound();
  const modules = await getOwnInstructorCurriculum(id);

  const text = locale === "fr" ? { title: "Modifier le programme", copy: "Ajoutez un module pour regrouper les leçons, puis ajoutez les leçons à ce module.", overview: "Aperçu du cours" } : locale === "es" ? { title: "Editar el plan de estudios", copy: "Añade un módulo para agrupar las lecciones y luego añade lecciones dentro de él.", overview: "Resumen del curso" } : { title: "Course curriculum", copy: "Add a module to group related lessons. Then add the lessons inside it.", overview: "Course overview" };
  const draft = course.status === "draft";
  const hasLessons = modules.some((module) => module.lessons.length > 0);
  const next = locale === "fr" ? "Continuer vers la couverture" : locale === "es" ? "Continuar a la portada" : "Continue to course cover";
  const hint = locale === "fr" ? "Enregistrez chaque leçon avant de continuer." : locale === "es" ? "Guarda cada lección antes de continuar." : "Save each lesson before continuing.";
  const waiting = locale === "fr" ? "Enregistrez votre première leçon pour continuer." : locale === "es" ? "Guarda tu primera lección para continuar." : "Save your first lesson to continue.";
  const courses = locale === "fr" ? "Mes cours" : locale === "es" ? "Mis cursos" : "My Courses";
  return <section className={`curriculum-page section-shell ${styles.page}`}><CourseWorkflow courseId={course.course_id} active="curriculum" draft={draft} />
    <header className="course-editor-heading curriculum-page-heading">
      <div><p className="eyebrow">{course.title}</p><h1>{text.title}</h1><p>{text.copy}</p></div>
      <div className="course-editor-status"><CourseStatusBadge status={course.status} /></div>
    </header>
    {draft && <p className={styles.workflowHint}>{hint}</p>}
    <CurriculumEditor courseId={course.course_id} status={course.status} initialModules={modules} />
    {draft && <div className={styles.workflowNext}>
      {!hasLessons && <p>{waiting}</p>}
      <div className={styles.workflowActions}>
        {hasLessons && <Link className="button button-primary" href={`/dashboard/instructor/courses/${course.course_id}?step=cover`}>{next}</Link>}
        <Link className="button button-secondary" href="/dashboard/instructor/courses">{courses}</Link>
      </div>
    </div>}
    {modules.length > 0 && <CurriculumSnapshot modules={modules} />}
  </section>;
}
