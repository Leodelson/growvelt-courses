import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseDraftForm } from "@/app/components/instructor/course-draft-form";
import { CourseSubmissionForm } from "@/app/components/instructor/course-submission-form";
import { CourseStatusBadge } from "@/app/components/instructor/course-status-badge";
import { CourseVideoCoverUpload } from "@/app/components/instructor/course-video-cover-upload";
import { getRequestLocale } from "@/app/lib/i18n-server";
import { getOwnInstructorCourse } from "@/app/lib/instructor/courses";
import { createClient } from "@/app/lib/supabase/server";

export const metadata = { title: "Edit course" };

export default async function DashboardInstructorCourseEditorPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const locale = await getRequestLocale();
  const text = locale === "fr" ? { metadata: "Informations du cours", url: "URL", updated: "Mis à jour", structure: "Structure du cours", build: "Construire le programme", readonly: "Programme en lecture seule", buildCopy: "Ajoutez des modules avec du texte, des vidéos et des quiz avant de soumettre ce cours à l’examen.", readonlyCopy: "Ce cours n’est pas un brouillon ; son programme ne peut donc pas être modifié par l’instructeur.", edit: "Modifier le programme", view: "Voir le programme", pending: "Examen en cours", reviewing: "Growvelt examine ce cours.", reviewCopy: "Ce cours reste en lecture seule jusqu’à ce qu’un administrateur l’approuve ou le renvoie pour modification. Aucun délai d’examen n’est garanti." } : locale === "es" ? { metadata: "Información del curso", url: "URL", updated: "Actualizado", structure: "Estructura del curso", build: "Crear el plan de estudios", readonly: "Plan de estudios de solo lectura", buildCopy: "Añade módulos con texto, vídeo y cuestionarios antes de enviar este curso a revisión.", readonlyCopy: "Este curso no es un borrador, por lo que el instructor no puede cambiar su plan de estudios.", edit: "Editar plan de estudios", view: "Ver plan de estudios", pending: "Revisión pendiente", reviewing: "Growvelt está revisando este curso.", reviewCopy: "Este curso será de solo lectura hasta que un administrador lo apruebe o lo devuelva para cambios. No garantizamos un plazo de revisión." } : { metadata: "Course metadata", url: "URL", updated: "Updated", structure: "Course structure", build: "Build the curriculum", readonly: "Curriculum is read-only", buildCopy: "Add modules with text, video, and quiz activities before submitting this course for review.", readonlyCopy: "This course is not a draft, so its curriculum cannot be changed by the Instructor.", edit: "Edit curriculum", view: "View curriculum", pending: "Pending review", reviewing: "Growvelt is reviewing this course.", reviewCopy: "This course is read-only until an Admin approves it for publication or returns it for changes. We do not provide a review ETA." };
  const id = Number(courseId);
  if (!Number.isSafeInteger(id) || id < 1) notFound();

  const course = await getOwnInstructorCourse(id);
  if (!course) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const updatedAt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(course.updated_at));

  return <section className="course-editor-page section-shell"><header className="course-editor-heading"><div><p className="eyebrow">{text.metadata}</p><h1>{course.title}</h1><p>{text.url}: <code>/{course.slug}</code></p></div><div className="course-editor-status"><CourseStatusBadge status={course.status} /><span>{text.updated} {updatedAt}</span></div></header><div className="course-editor-workspace"><CourseDraftForm mode="edit" courseId={course.course_id} status={course.status} initialValues={{ title: course.title, summary: course.summary ?? "", description: course.description ?? "", category: course.category ?? "Data Analytics", level: course.level ?? "Beginner", is_free: course.is_free, price_amount: course.price_amount, price_currency: course.price_currency }} /><aside className="course-editor-next"><p className="eyebrow">{text.structure}</p><h2>{course.status === "draft" ? text.build : text.readonly}</h2><p>{course.status === "draft" ? text.buildCopy : text.readonlyCopy}</p><Link className="button button-primary" href={`/dashboard/instructor/courses/${course.course_id}/curriculum`}>{course.status === "draft" ? text.edit : text.view}</Link></aside></div>{course.status === "draft" ? <><CourseVideoCoverUpload courseId={course.course_id} userId={user.id} /><CourseSubmissionForm courseId={course.course_id} /></> : course.status === "pending_review" ? <aside className="course-submission-panel course-submission-waiting"><p className="eyebrow">{text.pending}</p><h2>{text.reviewing}</h2><p>{text.reviewCopy}</p></aside> : null}</section>;
}
