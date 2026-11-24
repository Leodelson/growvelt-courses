import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseDraftForm } from "@/app/components/instructor/course-draft-form";
import { CourseSubmissionForm } from "@/app/components/instructor/course-submission-form";
import { CourseStatusBadge } from "@/app/components/instructor/course-status-badge";
import { CourseVideoCoverUpload } from "@/app/components/instructor/course-video-cover-upload";
import { CourseStepActions, CourseWorkflow } from "@/app/components/instructor/authoring-tools";
import { getRequestLocale } from "@/app/lib/i18n-server";
import { getOwnInstructorCourse } from "@/app/lib/instructor/courses";
import { getOwnInstructorCurriculum } from "@/app/lib/instructor/curriculum";
import { createClient } from "@/app/lib/supabase/server";
import styles from "@/app/components/instructor/workbench.module.css";

export const metadata = { title: "Edit course" };

const copy = {
  en: {
    details: "Course details", updated: "Updated", curriculum: "Add modules and lessons", view: "View curriculum",
    cover: "Course cover", coverHint: "Add a cover image or continue to review.",
    backToCurriculum: "Back to curriculum", backToCover: "Back to course cover", next: "Continue to review", review: "Submit for review",
    missing: "Save at least one lesson in a module before submitting this course.",
    pending: "Growvelt is reviewing this course.",
  },
  fr: {
    details: "Détails du cours", updated: "Mis à jour", curriculum: "Ajouter des modules et des leçons", view: "Voir le programme",
    cover: "Couverture du cours", coverHint: "Ajoutez une couverture ou passez à la révision.",
    backToCurriculum: "Retour au programme", backToCover: "Retour à la couverture", next: "Continuer vers la révision", review: "Soumettre à l’examen",
    missing: "Enregistrez au moins une leçon dans un module avant de soumettre ce cours.",
    pending: "Growvelt examine ce cours.",
  },
  es: {
    details: "Detalles del curso", updated: "Actualizado", curriculum: "Añadir módulos y lecciones", view: "Ver plan de estudios",
    cover: "Portada del curso", coverHint: "Añade una portada o continúa a la revisión.",
    backToCurriculum: "Volver al plan de estudios", backToCover: "Volver a la portada", next: "Continuar a la revisión", review: "Enviar a revisión",
    missing: "Guarda al menos una lección en un módulo antes de enviar este curso a revisión.",
    pending: "Growvelt está revisando este curso.",
  },
};

export default async function DashboardInstructorCourseEditorPage({ params, searchParams }: {
  params: Promise<{ courseId: string }>;
  searchParams?: Promise<{ step?: string | string[] }>;
}) {
  const [{ courseId }, locale, query] = await Promise.all([params, getRequestLocale(), searchParams]);
  const id = Number(courseId);
  if (!Number.isSafeInteger(id) || id < 1) notFound();

  const course = await getOwnInstructorCourse(id);
  if (!course) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const text = copy[locale];
  const draft = course.status === "draft";
  const base = "/dashboard/instructor/courses/" + course.course_id;
  const step = draft && (query?.step === "cover" || query?.step === "review") ? query.step : "details";
  const canSubmit = step === "review" && (await getOwnInstructorCurriculum(id)).some((module) => module.lessons.length > 0);
  const updatedAt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(course.updated_at));

  return (
    <section className={"course-editor-page section-shell " + styles.page}>
      <CourseWorkflow courseId={course.course_id} active={step} draft={draft} />
      <header className="course-editor-heading">
        <div>
          <p className="eyebrow">{step === "cover" ? text.cover : step === "review" ? text.review : text.details}</p>
          <h1>{course.title}</h1>
          {step === "details" && <p>URL: <code>/{course.slug}</code></p>}
        </div>
        <div className="course-editor-status">
          <CourseStatusBadge status={course.status} />
          <span>{text.updated} {updatedAt}</span>
        </div>
      </header>

      {step === "details" && (
        <>
          {course.status === "pending_review" && <p role="status">{text.pending}</p>}
          <CourseDraftForm
            userId={user.id}
            mode="edit" courseId={course.course_id} status={course.status}
            initialValues={{
              title: course.title,
              summary: course.summary ?? "",
              description: course.description ?? "",
              category: course.category ?? "Data Analytics",
              level: course.level ?? "Beginner",
              is_free: course.is_free,
              price_amount: course.price_amount,
              price_currency: course.price_currency,
              company_test_mode_only: course.company_test_mode_only,
            }}
          />
          {!draft && <Link className="button button-secondary" href={base + "/curriculum"}>{text.view}</Link>}
        </>
      )}

      {step === "cover" && (
        <CourseVideoCoverUpload
          courseId={course.course_id}
          userId={user.id}
          backHref={base + "/curriculum"}
          next={{ href: base + "?step=review", label: text.next }}
        />
      )}

      {step === "review" && (
        canSubmit ? <CourseSubmissionForm courseId={course.course_id} userId={user.id} backHref={base + "?step=cover"} /> : (
          <>
            <p role="status">{text.missing}</p>
            <CourseStepActions step={4} backHref={base + "?step=cover"}>
              <Link className="button button-primary" href={base + "/curriculum"}>{text.backToCurriculum}</Link>
            </CourseStepActions>
          </>
        )
      )}
    </section>
  );
}
