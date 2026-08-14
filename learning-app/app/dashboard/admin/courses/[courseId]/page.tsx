import { notFound, redirect } from "next/navigation";
import { CourseModerationForm } from "@/app/components/admin/course-moderation-form";
import type { CourseReviewLesson } from "@/app/lib/admin/course-moderation";
import { getLearningCourseForReview } from "@/app/lib/admin/course-moderation";
import { isLearningAdmin } from "@/app/lib/admin/authorization";

export const metadata = { title: "Review course" };

function formatDuration(seconds: number | null) {
  return seconds ? `${Math.round(seconds / 60)} min` : "Duration not supplied";
}

function LessonReview({ lesson, lessonIndex }: { lesson: CourseReviewLesson; lessonIndex: number }) {
  return <article className={`course-review-lesson course-review-lesson-${lesson.type}`}>
    <header className="course-review-lesson-heading">
      <div><span className="course-review-type">{lesson.type}</span><h3>{lessonIndex + 1}. {lesson.title}</h3></div>
      {lesson.isPreview && <span className="course-status-badge">Preview</span>}
    </header>
    {lesson.type === "video" && <div className="course-review-lesson-content"><p><strong>{formatDuration(lesson.durationSeconds)}</strong></p><p>{lesson.videoProvider || "Provider unavailable"} · {lesson.videoReference || "Reference unavailable"} · {lesson.videoVisibility || "Visibility unavailable"}</p></div>}
    {lesson.type === "text" && <p className="admin-bio course-review-text">{lesson.content || "No text content supplied."}</p>}
    {lesson.type === "quiz" && lesson.quiz && <section className="admin-quiz-review" aria-label={`Quiz structure for ${lesson.title}`}>
      <div className="admin-quiz-summary"><span><strong>{lesson.quiz.passingPercentage}%</strong> pass mark</span><span><strong>{lesson.quiz.questions.length}</strong> {lesson.quiz.questions.length === 1 ? "question" : "questions"}</span></div>
      <p className="admin-bio">{lesson.quiz.instructions || "No quiz instructions supplied."}</p>
      <ol className="admin-quiz-question-list">
        {lesson.quiz.questions.map((question) => <li key={question.id}>
          <strong>{question.text}</strong>
          <ul>{question.options.map((option) => <li className={option.isCorrect ? "is-correct" : undefined} key={option.id}><span>{option.text}</span>{option.isCorrect && <span className="admin-correct-answer">Correct answer</span>}</li>)}</ul>
        </li>)}
      </ol>
    </section>}
    {lesson.type === "quiz" && !lesson.quiz && <p className="inline-feedback inline-feedback-error">Quiz structure is unavailable. Do not publish until the submitted course is revalidated.</p>}
  </article>;
}

export default async function AdminCourseDetailPage({ params }: { params: Promise<{ courseId: string }> }) {
  if (!await isLearningAdmin()) redirect("/dashboard");
  const { courseId } = await params;
  const id = Number(courseId);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const course = await getLearningCourseForReview(id);
  if (!course) notFound();

  const submitted = course.submittedAt ? new Intl.DateTimeFormat("en", { dateStyle: "long", timeStyle: "short" }).format(new Date(course.submittedAt)) : "Submission date unavailable";
  const lessons = course.modules.flatMap((module) => module.lessons);
  const quizCount = lessons.filter((lesson) => lesson.type === "quiz").length;

  return <section className="admin-page admin-course-review-page section-shell">
    <header className="admin-page-header admin-review-hero">
      <p className="eyebrow">Course review</p>
      <h1>{course.title}</h1>
      <p>Submitted {submitted}</p>
      <div className="admin-review-summary" aria-label="Submitted course structure"><span><strong>{course.modules.length}</strong> modules</span><span><strong>{lessons.length}</strong> lessons</span><span><strong>{quizCount}</strong> quizzes</span></div>
    </header>
    <div className="admin-detail-grid admin-course-review-grid">
      <article className="admin-application-detail course-review-detail">
        <section className="admin-review-facts">
          <div><p className="eyebrow">Instructor</p><p className="admin-identity"><strong>{course.instructor.name || "Name unavailable"}</strong><span>{course.instructor.email || "Email unavailable"}</span></p></div>
          <div><p className="eyebrow">Course metadata</p><p><strong>{course.category || "Uncategorized"}</strong> · {course.level || "Level not set"} · {course.isFree ? "Free" : `${course.priceCurrency || "NGN"} ${Number(course.priceAmount ?? 0).toLocaleString("en-NG")}`}</p></div>
        </section>
        <section><p className="eyebrow">Course overview</p><h2>{course.summary || "No summary supplied."}</h2><p className="admin-bio">{course.description || "No description supplied."}</p></section>
        <section><p className="eyebrow">Rights declaration</p><p>{course.declaration.version || "Declaration unavailable"} · {course.declaration.basis || "Basis unavailable"}</p><p>{course.declaration.acceptedAt ? `Accepted ${new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(course.declaration.acceptedAt))}` : "Acceptance time unavailable"}</p></section>
        <section><p className="eyebrow">Curriculum review</p><div className="course-review-curriculum">{course.modules.map((module, moduleIndex) => <section className="course-review-module" key={module.id}><header><span>Module {String(moduleIndex + 1).padStart(2, "0")}</span><h2>{module.title}</h2><small>{module.lessons.length} {module.lessons.length === 1 ? "lesson" : "lessons"}</small></header><div>{module.lessons.map((lesson, lessonIndex) => <LessonReview lesson={lesson} lessonIndex={lessonIndex} key={lesson.id} />)}</div></section>)}</div></section>
      </article>
      <CourseModerationForm courseId={course.courseId} />
    </div>
  </section>;
}
