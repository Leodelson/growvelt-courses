import { notFound, redirect } from "next/navigation";
import { CourseModerationForm } from "@/app/components/admin/course-moderation-form";
import { CourseVideoCover } from "@/app/components/course-video-cover";
import type { CourseReviewLesson } from "@/app/lib/admin/course-moderation";
import { getLearningCourseForReview } from "@/app/lib/admin/course-moderation";
import { isLearningAdmin } from "@/app/lib/admin/authorization";
import { getRequestLocale } from "@/app/lib/i18n-server";

export const metadata = { title: "Review course" };

function formatDuration(seconds: number | null, fallback: string) {
  return seconds ? `${Math.round(seconds / 60)} min` : fallback;
}

function LessonReview({ lesson, lessonIndex, locale }: { lesson: CourseReviewLesson; lessonIndex: number; locale: "en" | "fr" | "es" }) {
  const text = locale === "fr" ? { preview: "Aperçu", duration: "Durée non fournie", provider: "Fournisseur indisponible", reference: "Référence indisponible", visibility: "Visibilité indisponible", noText: "Aucun contenu texte fourni.", structure: "Structure du quiz pour", pass: "seuil de réussite", question: "question", questions: "questions", noInstructions: "Aucune instruction de quiz fournie.", correct: "Bonne réponse", invalid: "La structure du quiz est indisponible. Ne publiez pas avant une nouvelle validation du cours." } : locale === "es" ? { preview: "Vista previa", duration: "Duración no proporcionada", provider: "Proveedor no disponible", reference: "Referencia no disponible", visibility: "Visibilidad no disponible", noText: "No se proporcionó contenido de texto.", structure: "Estructura del cuestionario para", pass: "nota de aprobación", question: "pregunta", questions: "preguntas", noInstructions: "No se proporcionaron instrucciones.", correct: "Respuesta correcta", invalid: "La estructura del cuestionario no está disponible. No publiques hasta volver a validar el curso." } : { preview: "Preview", duration: "Duration not supplied", provider: "Provider unavailable", reference: "Reference unavailable", visibility: "Visibility unavailable", noText: "No text content supplied.", structure: "Quiz structure for", pass: "pass mark", question: "question", questions: "questions", noInstructions: "No quiz instructions supplied.", correct: "Correct answer", invalid: "Quiz structure is unavailable. Do not publish until the submitted course is revalidated." };
  return <article className={`course-review-lesson course-review-lesson-${lesson.type}`}>
    <header className="course-review-lesson-heading">
      <div><span className="course-review-type">{lesson.type}</span><h3>{lessonIndex + 1}. {lesson.title}</h3></div>
      {lesson.isPreview && <span className="course-status-badge">{text.preview}</span>}
    </header>
    {lesson.type === "video" && <div className="course-review-lesson-content"><p><strong>{formatDuration(lesson.durationSeconds, text.duration)}</strong></p><p>{lesson.videoProvider || text.provider} · {lesson.videoReference || text.reference} · {lesson.videoVisibility || text.visibility}</p></div>}
    {lesson.type === "text" && <p className="admin-bio course-review-text">{lesson.content || text.noText}</p>}
    {lesson.type === "quiz" && lesson.quiz && <section className="admin-quiz-review" aria-label={`${text.structure} ${lesson.title}`}>
      <div className="admin-quiz-summary"><span><strong>{lesson.quiz.passingPercentage}%</strong> {text.pass}</span><span><strong>{lesson.quiz.questions.length}</strong> {lesson.quiz.questions.length === 1 ? text.question : text.questions}</span></div>
      <p className="admin-bio">{lesson.quiz.instructions || text.noInstructions}</p>
      <ol className="admin-quiz-question-list">
        {lesson.quiz.questions.map((question) => <li key={question.id}>
          <strong>{question.text}</strong>
          <ul>{question.options.map((option) => <li className={option.isCorrect ? "is-correct" : undefined} key={option.id}><span>{option.text}</span>{option.isCorrect && <span className="admin-correct-answer">{text.correct}</span>}</li>)}</ul>
        </li>)}
      </ol>
    </section>}
    {lesson.type === "quiz" && !lesson.quiz && <p className="inline-feedback inline-feedback-error">{text.invalid}</p>}
  </article>;
}

export default async function AdminCourseDetailPage({ params }: { params: Promise<{ courseId: string }> }) {
  if (!await isLearningAdmin()) redirect("/dashboard");
  const locale = await getRequestLocale();
  const text = locale === "fr" ? { unavailable: "Date de soumission indisponible", review: "Examen du cours", submitted: "Soumis le", structure: "Structure du cours soumis", modules: "modules", lessons: "leçons", quizzes: "quiz", instructor: "Instructeur", noName: "Nom indisponible", noEmail: "E-mail indisponible", metadata: "Informations du cours", uncategorized: "Sans catégorie", noLevel: "Niveau non défini", free: "Gratuit", cover: "Couverture vidéo du cours", coverAlt: "Couverture vidéo du cours", overview: "Présentation du cours", noSummary: "Aucun résumé fourni.", noDescription: "Aucune description fournie.", rights: "Déclaration de droits", noDeclaration: "Déclaration indisponible", noBasis: "Base indisponible", accepted: "Acceptée le", noAcceptance: "Date d’acceptation indisponible", curriculum: "Examen du programme", module: "Module", lesson: "leçon", lessonPlural: "leçons" } : locale === "es" ? { unavailable: "Fecha de envío no disponible", review: "Revisión del curso", submitted: "Enviado el", structure: "Estructura del curso enviado", modules: "módulos", lessons: "lecciones", quizzes: "cuestionarios", instructor: "Instructor", noName: "Nombre no disponible", noEmail: "Correo no disponible", metadata: "Información del curso", uncategorized: "Sin categoría", noLevel: "Nivel no definido", free: "Gratis", cover: "Portada de vídeo del curso", coverAlt: "Portada de vídeo del curso", overview: "Resumen del curso", noSummary: "No se proporcionó resumen.", noDescription: "No se proporcionó descripción.", rights: "Declaración de derechos", noDeclaration: "Declaración no disponible", noBasis: "Base no disponible", accepted: "Aceptada el", noAcceptance: "Fecha de aceptación no disponible", curriculum: "Revisión del plan de estudios", module: "Módulo", lesson: "lección", lessonPlural: "lecciones" } : { unavailable: "Submission date unavailable", review: "Course review", submitted: "Submitted", structure: "Submitted course structure", modules: "modules", lessons: "lessons", quizzes: "quizzes", instructor: "Instructor", noName: "Name unavailable", noEmail: "Email unavailable", metadata: "Course metadata", uncategorized: "Uncategorized", noLevel: "Level not set", free: "Free", cover: "Course video cover", coverAlt: "Course video cover for", overview: "Course overview", noSummary: "No summary supplied.", noDescription: "No description supplied.", rights: "Rights declaration", noDeclaration: "Declaration unavailable", noBasis: "Basis unavailable", accepted: "Accepted", noAcceptance: "Acceptance time unavailable", curriculum: "Curriculum review", module: "Module", lesson: "lesson", lessonPlural: "lessons" };
  const { courseId } = await params;
  const id = Number(courseId);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const course = await getLearningCourseForReview(id);
  if (!course) notFound();

  const submitted = course.submittedAt ? new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(new Date(course.submittedAt)) : text.unavailable;
  const lessons = course.modules.flatMap((module) => module.lessons);
  const quizCount = lessons.filter((lesson) => lesson.type === "quiz").length;

  return <section className="admin-page admin-course-review-page section-shell">
    <header className="admin-page-header admin-review-hero">
      <p className="eyebrow">{text.review}</p>
      <h1>{course.title}</h1>
      <p>{text.submitted} {submitted}</p>
      <div className="admin-review-summary" aria-label={text.structure}><span><strong>{course.modules.length}</strong> {text.modules}</span><span><strong>{lessons.length}</strong> {text.lessons}</span><span><strong>{quizCount}</strong> {text.quizzes}</span></div>
    </header>
    <div className="admin-detail-grid admin-course-review-grid">
      <article className="admin-application-detail course-review-detail">
        <section className="admin-review-facts">
          <div><p className="eyebrow">{text.instructor}</p><p className="admin-identity"><strong>{course.instructor.name || text.noName}</strong><span>{course.instructor.email || text.noEmail}</span></p></div>
          <div><p className="eyebrow">{text.metadata}</p><p><strong>{course.category || text.uncategorized}</strong> · {course.level || text.noLevel} · {course.isFree ? text.free : `${course.priceCurrency || "NGN"} ${Number(course.priceAmount ?? 0).toLocaleString(locale)}`}</p></div>
        </section>
        <section className="admin-course-cover-review"><p className="eyebrow">{text.cover}</p><div className="admin-course-video-cover"><CourseVideoCover courseId={course.courseId} alt={`${text.coverAlt} ${course.title}`} loading="eager" /></div></section>
        <section><p className="eyebrow">{text.overview}</p><h2 className="course-review-overview-title">{course.summary || text.noSummary}</h2><p className="admin-bio course-review-overview-copy">{course.description || text.noDescription}</p></section>
        <section><p className="eyebrow">{text.rights}</p><p>{course.declaration.version || text.noDeclaration} · {course.declaration.basis || text.noBasis}</p><p>{course.declaration.acceptedAt ? `${text.accepted} ${new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(course.declaration.acceptedAt))}` : text.noAcceptance}</p></section>
        <section><p className="eyebrow">{text.curriculum}</p><div className="course-review-curriculum">{course.modules.map((module, moduleIndex) => <section className="course-review-module" key={module.id}><header><span>{text.module} {String(moduleIndex + 1).padStart(2, "0")}</span><h2>{module.title}</h2><small>{module.lessons.length} {module.lessons.length === 1 ? text.lesson : text.lessonPlural}</small></header><div>{module.lessons.map((lesson, lessonIndex) => <LessonReview lesson={lesson} lessonIndex={lessonIndex} locale={locale} key={lesson.id} />)}</div></section>)}</div></section>
      </article>
      <CourseModerationForm courseId={course.courseId} />
    </div>
  </section>;
}
