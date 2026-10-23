import Link from "next/link";
import { redirect } from "next/navigation";
import { getOwnInstructorLearningAnalytics } from "@/app/lib/instructor/analytics";
import { isApprovedInstructor } from "@/app/lib/instructor/authorization";
import { InstructorCourseActions } from "@/app/components/instructor/instructor-course-actions";
import { getRequestLocale } from "@/app/lib/i18n-server";

import { WorkbenchList } from "@/app/components/instructor/workbench-list";
import { workbenchCopy } from "@/app/lib/instructor/workbench";
import styles from "@/app/components/instructor/workbench.module.css";

export const metadata = { title: "Instructor workspace" };

const copy = {
  en: { eyebrow: "Instructor Course Analytics", title: "Your teaching workspace.", intro: "Follow course enrollments, completion and quiz participation. Individual learner answers stay private.", courses: "My Courses", create: "Create Course", published: "published", learners: "Course enrollments", completed: "completed", rate: "Completion rate", rateCopy: "Across active and completed enrollments", attempts: "Quiz attempts", attemptsCopy: "Passed attempts and scores appear per course", performance: "Course performance", progress: "Progress across your courses", metrics: "Metrics are aggregate-only and update as learners make progress.", enrolled: "Enrolled", active: "Active", completion: "Completion", quiz: "quiz", quizzes: "quizzes", attempt: "attempts", passRate: "attempt pass rate", average: "average score", noQuiz: "No quiz lessons in this course yet.", empty: "No course analytics yet", emptyTitle: "Create your first course to begin.", emptyCopy: "Once a course is published and learners enroll, this workspace will show its enrollment, completion, and quiz engagement metrics.", draft: "Draft", pending: "Pending review", archived: "Archived" },
  fr: { eyebrow: "Analyses de l’instructeur", title: "Suivez la progression de vos expériences d’apprentissage.", intro: "Suivez les inscriptions, les achèvements et l’engagement aux quiz à partir des dossiers Growvelt. Les réponses individuelles restent privées.", courses: "Mes cours", create: "Créer un cours", published: "publiés", learners: "Inscriptions aux cours", completed: "terminés", rate: "Taux d’achèvement", rateCopy: "Parmi les inscriptions actives et terminées", attempts: "Tentatives de quiz", attemptsCopy: "Les tentatives réussies et les scores apparaissent par cours", performance: "Performance des cours", progress: "Progrès sur vos cours", metrics: "Les indicateurs sont agrégés et se mettent à jour à mesure que les apprenants progressent.", enrolled: "Inscrits", active: "Actifs", completion: "Achèvement", quiz: "quiz", quizzes: "quiz", attempt: "tentatives", passRate: "taux de réussite", average: "score moyen", noQuiz: "Ce cours ne comporte pas encore de leçon de quiz.", empty: "Aucune analyse de cours", emptyTitle: "Créez votre premier cours pour commencer.", emptyCopy: "Une fois un cours publié et des apprenants inscrits, cet espace affichera les données d’inscription, d’achèvement et d’engagement aux quiz.", draft: "Brouillon", pending: "En attente", archived: "Archivé" },
  es: { eyebrow: "Analítica del instructor", title: "Consulta cómo avanzan tus experiencias de aprendizaje.", intro: "Sigue la inscripción, finalización y participación en cuestionarios desde los registros de Growvelt. Las respuestas individuales permanecen privadas.", courses: "Mis cursos", create: "Crear curso", published: "publicados", learners: "Inscripciones en cursos", completed: "completados", rate: "Tasa de finalización", rateCopy: "Entre inscripciones activas y completadas", attempts: "Intentos de cuestionario", attemptsCopy: "Los intentos aprobados y las puntuaciones aparecen por curso", performance: "Rendimiento de los cursos", progress: "Progreso en tus cursos", metrics: "Las métricas son agregadas y se actualizan a medida que los estudiantes avanzan.", enrolled: "Inscritos", active: "Activos", completion: "Finalización", quiz: "cuestionario", quizzes: "cuestionarios", attempt: "intentos", passRate: "tasa de aprobación", average: "puntuación media", noQuiz: "Aún no hay lecciones de cuestionario en este curso.", empty: "Aún no hay analítica de cursos", emptyTitle: "Crea tu primer curso para empezar.", emptyCopy: "Una vez que se publique un curso y los estudiantes se inscriban, este espacio mostrará sus métricas de inscripción, finalización y cuestionarios.", draft: "Borrador", pending: "En revisión", archived: "Archivado" },
} as const;

function statusLabel(status: "draft" | "pending_review" | "published" | "archived", text: { pending: string; draft: string; archived: string; published: string }) {
  return status === "pending_review" ? text.pending : status === "draft" ? text.draft : status === "archived" ? text.archived : text.published;
}

export default async function DashboardInstructorPage() {
  if (!(await isApprovedInstructor())) redirect("/teach");

  const [analytics, locale] = await Promise.all([getOwnInstructorLearningAnalytics(), getRequestLocale()]);
  const text = copy[locale];
  const ui = workbenchCopy[locale];
  const publishedCourses = analytics.courses.filter((course) => course.status === "published").length;

  return <section className={`instructor-analytics-page section-shell ${styles.page}`}>
    <header className="instructor-analytics-hero">
      <div>
        <p className="eyebrow">{text.eyebrow}</p><h1>{text.title}</h1><p>{text.intro}</p>
      </div>
      <div className="workspace-actions">
        <Link className="button button-secondary" href="/dashboard/instructor/courses">{text.courses}</Link>{analytics.courses.length > 0 && <Link className="button button-primary" href="/dashboard/instructor/courses/new">{text.create}</Link>}
      </div>
    </header>

    <section className="instructor-analytics-summary" aria-label="Instructor Course Analytics summary">
      <article><span>{text.courses}</span><strong>{analytics.courses.length}</strong><small>{publishedCourses} {text.published}</small></article><article><span>{text.learners}</span><strong>{analytics.totalEnrolledLearners}</strong><small>{analytics.totalCompletedLearners} {text.completed}</small></article><article><span>{text.rate}</span><strong>{analytics.overallCompletionRate}%</strong><small>{text.rateCopy}</small></article><article><span>{text.attempts}</span><strong>{analytics.totalQuizAttempts}</strong><small>{text.attemptsCopy}</small></article>
    </section>

    {analytics.courses.length > 0 && <section className={styles.pipeline} aria-labelledby="instructor-pipeline-title"><h2 id="instructor-pipeline-title">{ui.pipeline}</h2><p>{ui.pipelineCopy}</p><nav>{[{key:"draft",label:ui.drafts},{key:"pending_review",label:ui.pending},{key:"published",label:ui.published},{key:"archived",label:ui.archived}].map(item => <Link key={item.key} href={`/dashboard/instructor/courses?status=${item.key}`}><strong>{analytics.courses.filter(course=>course.status===item.key).length}</strong><span>{item.label}</span></Link>)}</nav></section>}

    {analytics.courses.length > 0 ? <section className="instructor-analytics-courses" aria-label="Course performance">
      <header><div><p className="eyebrow">{text.performance}</p><h2>{text.progress}</h2></div><p>{text.metrics}</p></header>
      <div className="instructor-analytics-course-list">
        <WorkbenchList metricLabel={ui.enrollments} statuses={{draft:text.draft,pending_review:text.pending,published:text.published,archived:text.archived}} items={analytics.courses.map((course) => ({ id:String(course.courseId),title:course.title,status:course.status,keywords:"",metric:course.enrolledLearnerCount,content:<article>
          <div className="instructor-analytics-course-heading">
            <div><span className={`course-status-badge is-${course.status}`}>{statusLabel(course.status, text)}</span><h3><Link href={`/dashboard/instructor/courses/${course.courseId}`}>{course.title}</Link></h3></div>
            <InstructorCourseActions courseId={course.courseId} status={course.status} title={course.title} />
          </div>
          <dl>
            <div><dt>{text.enrolled}</dt><dd>{course.enrolledLearnerCount}</dd></div>
            <div><dt>{text.active}</dt><dd>{course.activeLearnerCount}</dd></div>
            <div><dt>{text.completed}</dt><dd>{course.completedLearnerCount}</dd></div>
            <div><dt>{text.completion}</dt><dd>{course.completionRate}%</dd></div>
          </dl>
          <div className="instructor-analytics-progress" aria-label={`${course.completionRate}% course completion`}><span style={{ width: `${course.completionRate}%` }} /></div>
          {course.quizCount > 0 ? <div className="instructor-quiz-insight"><span>{course.quizCount} {course.quizCount === 1 ? text.quiz : text.quizzes}</span><span>{course.quizAttemptCount} {text.attempt}</span><span>{course.quizAttemptPassRate}% {text.passRate}</span><span>{course.averageQuizScore}% {text.average}</span></div> : <p className="instructor-analytics-empty-note">{text.noQuiz}</p>}
        </article>}))} />
      </div>
    </section> : <section className="instructor-analytics-empty">
      <p className="eyebrow">{text.empty}</p>
      <h2>{text.emptyTitle}</h2>
      <p>{text.emptyCopy}</p>
      <Link className="button button-primary" href="/dashboard/instructor/courses/new">{text.create}</Link>
    </section>}
  </section>;
}
