import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CircleHelp,
  CirclePlay,
  ClipboardList,
  FileText,
  LockKeyhole,
} from "lucide-react";
import { LessonCompleteButton } from "@/app/components/learning/lesson-complete-button";
import { QuizPlayer } from "@/app/components/learning/quiz-player";
import { getRequestLocale } from "@/app/lib/i18n-server";
import { getOwnEnrolledLearningCourse } from "@/app/lib/learning/enrollments";
import { getOwnEnrolledLessonSnapshot } from "@/app/lib/learning/lesson-player";
import { getOwnEnrolledQuizSnapshot } from "@/app/lib/learning/quiz";
import styles from "./lesson-player.module.css";

export const metadata = { title: "Lesson" };

const copy = {
  en: {
    back: "Back to course",
    jump: "Skip to lesson content",
    courseContent: "Course content",
    lessonsLabel: "lessons",
    modulesLabel: "modules",
    progress: "Course progress",
    of: "of",
    later: "Coming later",
    current: "Current lesson",
    passed: "Quiz passed",
    completed: "Completed",
    video: "Video",
    text: "Text",
    quiz: "Quiz",
    project: "Project",
    videoLesson: "Video lesson",
    textLesson: "Text lesson",
    assessment: "Quiz assessment",
    unavailable: "Lesson unavailable",
    videoUnavailable: "This video reference is unavailable.",
    textUnavailable: "This lesson content is unavailable.",
    typeUnavailable: "This lesson type is not available in the player yet.",
    courseCompleted: "Course completed. Your certificate is available from the course page.",
    previous: "Previous lesson",
    next: "Next lesson",
    completedCourse: "View completed course",
    upNext: "Up next",
    aboutCourse: "About this course",
  },
  fr: {
    back: "Retour au cours",
    jump: "Passer au contenu de la leçon",
    courseContent: "Contenu du cours",
    lessonsLabel: "leçons",
    modulesLabel: "modules",
    progress: "Progression du cours",
    of: "sur",
    later: "Bientôt disponible",
    current: "Leçon actuelle",
    passed: "Quiz réussi",
    completed: "Terminé",
    video: "Vidéo",
    text: "Texte",
    quiz: "Quiz",
    project: "Projet",
    videoLesson: "Leçon vidéo",
    textLesson: "Leçon texte",
    assessment: "Évaluation par quiz",
    unavailable: "Leçon indisponible",
    videoUnavailable: "Cette référence vidéo n’est pas disponible.",
    textUnavailable: "Le contenu de cette leçon n’est pas disponible.",
    typeUnavailable: "Ce type de leçon n’est pas encore disponible dans le lecteur.",
    courseCompleted: "Cours terminé. Votre certificat est disponible depuis la page du cours.",
    previous: "Leçon précédente",
    next: "Leçon suivante",
    completedCourse: "Voir le cours terminé",
    upNext: "À suivre",
    aboutCourse: "À propos de ce cours",
  },
  es: {
    back: "Volver al curso",
    jump: "Ir al contenido de la lección",
    courseContent: "Contenido del curso",
    lessonsLabel: "lecciones",
    modulesLabel: "módulos",
    progress: "Progreso del curso",
    of: "de",
    later: "Próximamente",
    current: "Lección actual",
    passed: "Cuestionario aprobado",
    completed: "Completado",
    video: "Vídeo",
    text: "Texto",
    quiz: "Cuestionario",
    project: "Proyecto",
    videoLesson: "Lección de vídeo",
    textLesson: "Lección de texto",
    assessment: "Evaluación de cuestionario",
    unavailable: "Lección no disponible",
    videoUnavailable: "Esta referencia de vídeo no está disponible.",
    textUnavailable: "El contenido de esta lección no está disponible.",
    typeUnavailable: "Este tipo de lección aún no está disponible en el reproductor.",
    courseCompleted: "Curso completado. Tu certificado está disponible en la página del curso.",
    previous: "Lección anterior",
    next: "Siguiente lección",
    completedCourse: "Ver curso completado",
    upNext: "A continuación",
    aboutCourse: "Sobre este curso",
  },
} as const;

function youtubeEmbed(reference: string) {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(reference)}`;
}

function LessonTypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = type === "video"
    ? CirclePlay
    : type === "text"
      ? FileText
      : type === "quiz"
        ? CircleHelp
        : type === "project"
          ? ClipboardList
          : BookOpen;

  return <Icon className={className} size={17} strokeWidth={1.8} aria-hidden="true" />;
}

export default async function EnrolledLessonPage({ params }: { params: Promise<{ slug: string; lessonId: string }> }) {
  const [{ slug, lessonId }, locale] = await Promise.all([params, getRequestLocale()]);
  const text = copy[locale];
  const parsedLessonId = Number(lessonId);

  if (!slug || slug.length > 220 || !Number.isSafeInteger(parsedLessonId) || parsedLessonId < 1) notFound();

  const [snapshot, course] = await Promise.all([
    getOwnEnrolledLessonSnapshot(slug, parsedLessonId),
    getOwnEnrolledLearningCourse(slug),
  ]);
  if (!snapshot || !course || snapshot.course.id !== course.id) notFound();

  const { current } = snapshot;
  const quiz = current.type === "quiz" ? await getOwnEnrolledQuizSnapshot(slug, parsedLessonId) : null;
  if (current.type === "quiz" && !quiz) notFound();

  const courseHref = `/dashboard/my-learning/${encodeURIComponent(snapshot.course.slug)}`;
  const navigableLessons = course.modules.flatMap((module) => module.lessons.filter((lesson) => lesson.type !== "project"));
  const index = navigableLessons.findIndex((lesson) => lesson.id === current.id);
  const previousId = index > 0 ? navigableLessons[index - 1].id : null;
  const nextLesson = index >= 0 ? navigableLessons[index + 1] ?? null : null;
  const nextHref = nextLesson ? `${courseHref}/lessons/${nextLesson.id}` : null;
  const activeModule = snapshot.modules.find((module) => module.lessons.some((lesson) => lesson.id === current.id));
  const nextModule = nextLesson
    ? course.modules.find((module) => module.lessons.some((lesson) => lesson.id === nextLesson.id))
    : null;
  const progressPercent = Math.min(100, Math.max(0, Math.round(course.progressPercent)));
  const courseDescription = course.description?.trim() || course.summary?.trim() || null;
  const lessonType = current.type === "video"
    ? text.videoLesson
    : current.type === "text"
      ? text.textLesson
      : current.type === "quiz"
        ? text.assessment
        : text.unavailable;

  const typeLabel = (type: string) => type === "video"
    ? text.video
    : type === "text"
      ? text.text
      : type === "quiz"
        ? text.quiz
        : text.project;

  const navLabel = (lesson: { type: string; completed: boolean; current: boolean }) => lesson.current
    ? text.current
    : lesson.completed
      ? lesson.type === "quiz" ? text.passed : text.completed
      : lesson.type === "video"
        ? text.video
        : lesson.type === "text"
          ? text.text
          : lesson.type === "quiz"
            ? text.quiz
            : text.later;

  return (
    <section className={styles.lessonPage}>
      <header className={styles.courseHeader}>
        <div className={styles.headerTop}>
          <Link className={styles.backLink} href={courseHref}>
            <ArrowLeft size={17} strokeWidth={1.9} aria-hidden="true" />
            <span>{text.back}</span>
          </Link>
          <span className={styles.headerCourseTitle}>{snapshot.course.title}</span>
        </div>
        <div className={styles.headerMain}>
          <div className={styles.headingText}>
            <p className={styles.courseEyebrow}>
              {activeModule?.title ?? text.courseContent}
              <span aria-hidden="true"> · </span>
              {lessonType}
            </p>
            <h1>{current.title}</h1>
          </div>
          <div className={styles.progressBlock}>
            <div className={styles.progressLabels}>
              <span>{text.progress}</span>
              <strong>{course.completedLessons} {text.of} {course.totalLessons} {text.lessonsLabel}</strong>
            </div>
            <div
              className={styles.progressTrack}
              role="progressbar"
              aria-label={text.progress}
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </div>
        <a className={styles.jumpLink} href="#lesson-content">{text.jump}</a>
      </header>

      <div className={styles.lessonLayout}>
        <article id="lesson-content" tabIndex={-1} className={styles.lessonColumn}>
          <section className={styles.lessonPanel} aria-label={current.title}>
            <div className={styles.lessonPanelHeading}>
              <span className={styles.lessonType}>
                <LessonTypeIcon type={current.type} />
                {lessonType}
              </span>
              {current.durationSeconds ? (
                <span className={styles.lessonDuration}>
                  {Math.max(1, Math.ceil(current.durationSeconds / 60))} min
                </span>
              ) : null}
            </div>

            {current.type === "video"
              ? current.videoProvider === "youtube" && current.videoReference
                ? (
                  <div className={styles.videoFrame}>
                    <iframe
                      src={youtubeEmbed(current.videoReference)}
                      title={current.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                )
                : <p className={styles.lessonMessage}>{text.videoUnavailable}</p>
              : current.type === "text"
                ? <div className={styles.textContent}>{current.textContent || text.textUnavailable}</div>
                : current.type === "quiz" && quiz
                  ? <div className={styles.quizContent}><QuizPlayer quiz={quiz} slug={slug} lessonId={current.id} nextHref={nextHref} courseHref={courseHref} /></div>
                  : <p className={styles.lessonMessage}>{text.typeUnavailable}</p>}

            {course.enrollmentStatus === "completed" && (
              <p className={styles.completedMessage} role="status">
                <CheckCircle2 size={18} aria-hidden="true" />
                <span>{text.courseCompleted}</span>
              </p>
            )}

            {(current.type === "video" || current.type === "text") && (
              <div className={styles.lessonActions}>
                <LessonCompleteButton courseId={snapshot.course.id} lessonId={current.id} completed={current.completed} />
                {previousId ? (
                  <Link className={`${styles.previousLink} button button-secondary`} href={`${courseHref}/lessons/${previousId}`}>
                    <ArrowLeft size={16} aria-hidden="true" />
                    <span>{text.previous}</span>
                  </Link>
                ) : null}
              </div>
            )}
          </section>

          {nextLesson && nextHref ? (
            <section className={styles.upNext} aria-labelledby="up-next-title">
              <span className={styles.upNextIcon}><LessonTypeIcon type={nextLesson.type} /></span>
              <div className={styles.upNextDetails}>
                <p className={styles.upNextEyebrow}>
                  {text.upNext}
                  {nextModule ? <><span aria-hidden="true"> · </span>{nextModule.title}</> : null}
                </p>
                <h2 id="up-next-title">{nextLesson.title}</h2>
                <span className={styles.upNextType}><LessonTypeIcon type={nextLesson.type} />{typeLabel(nextLesson.type)}</span>
              </div>
              <Link className={`${styles.upNextAction} button button-primary`} href={nextHref} aria-label={`${text.next}: ${nextLesson.title}`}>
                <span>{text.next}</span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </section>
          ) : course.enrollmentStatus === "completed" ? (
            <Link className={`${styles.upNext} ${styles.completedCourseLink}`} href={courseHref}>
              <span className={styles.upNextIcon}><CheckCircle2 size={20} aria-hidden="true" /></span>
              <span className={styles.completedCourseText}>{text.courseCompleted}</span>
              <span className={styles.completedCourseAction}>{text.completedCourse}<ArrowRight size={16} aria-hidden="true" /></span>
            </Link>
          ) : null}
        </article>

        <div className={styles.courseSidebar}>
          <aside className={styles.courseOutline} aria-labelledby="course-content-title">
            <div className={styles.outlineHeader}>
              <div>
                <p className={styles.outlineEyebrow}>{text.courseContent}</p>
                <h2 id="course-content-title">{snapshot.course.title}</h2>
                <p className={styles.outlineCounts}>{snapshot.modules.length} {text.modulesLabel}<span aria-hidden="true"> · </span>{course.totalLessons} {text.lessonsLabel}</p>
              </div>
              <span className={styles.progressPercent}>{progressPercent}%</span>
            </div>

            {snapshot.modules.map((module) => {
              const completedInModule = module.lessons.filter((lesson) => lesson.completed).length;
              return (
                <section className={styles.moduleSection} key={module.id} aria-label={module.title}>
                  <div className={styles.moduleHeading}>
                    <h3>{module.title}</h3>
                    <span>{completedInModule}/{module.lessons.length}</span>
                  </div>
                  <ol className={styles.lessonList}>
                    {module.lessons.map((lesson) => {
                      const className = [
                        styles.lessonRow,
                        lesson.current ? styles.currentLesson : "",
                        lesson.completed ? styles.completedLesson : "",
                        lesson.type === "project" ? styles.unavailableLesson : "",
                      ].filter(Boolean).join(" ");

                      return (
                        <li key={lesson.id}>
                          {lesson.type === "project" ? (
                            <div className={className} aria-disabled="true">
                              <span className={styles.lessonTypeIcon}><LockKeyhole size={16} aria-hidden="true" /></span>
                              <span className={styles.lessonDetails}>
                                <span className={styles.lessonTitle}>{lesson.title}</span>
                                <small>{text.later}</small>
                              </span>
                            </div>
                          ) : (
                            <Link className={className} href={`${courseHref}/lessons/${lesson.id}`} aria-current={lesson.current ? "page" : undefined}>
                              <span className={styles.lessonTypeIcon}><LessonTypeIcon type={lesson.type} /></span>
                              <span className={styles.lessonDetails}>
                                <span className={styles.lessonTitle}>{lesson.title}</span>
                                <small>{navLabel(lesson)}</small>
                              </span>
                              {lesson.completed ? <CheckCircle2 className={styles.lessonStatusIcon} size={16} aria-label={text.completed} /> : null}
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </section>
              );
            })}
          </aside>

          {courseDescription ? (
            <section className={styles.courseAbout} aria-labelledby="course-about-title">
              <h2 id="course-about-title">{text.aboutCourse}</h2>
              <p>{courseDescription}</p>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}
