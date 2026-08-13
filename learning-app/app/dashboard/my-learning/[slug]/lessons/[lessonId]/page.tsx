import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonCompleteButton } from "@/app/components/learning/lesson-complete-button";
import { QuizPlayer } from "@/app/components/learning/quiz-player";
import { getOwnEnrolledLearningCourse } from "@/app/lib/learning/enrollments";
import { getOwnEnrolledLessonSnapshot } from "@/app/lib/learning/lesson-player";
import { getOwnEnrolledQuizSnapshot } from "@/app/lib/learning/quiz";

export const metadata = { title: "Lesson" };

function youtubeEmbed(reference: string) {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(reference)}`;
}

export default async function EnrolledLessonPage({ params }: { params: Promise<{ slug: string; lessonId: string }> }) {
  const { slug, lessonId } = await params;
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
  const isEligible = current.type === "video" || current.type === "text" || current.type === "quiz";
  const courseHref = `/dashboard/my-learning/${encodeURIComponent(snapshot.course.slug)}`;
  const eligibleLessonIds = course.modules.flatMap((module) => module.lessons.filter((lesson) => lesson.type !== "project").map((lesson) => lesson.id));
  const isFinalEligibleLesson = isEligible && eligibleLessonIds.at(-1) === current.id;

  const nextHref = current.nextId ? `${courseHref}/lessons/${current.nextId}` : null;
  return <section className="lesson-player-page section-shell"><header className="lesson-player-heading"><Link className="back-link" href={courseHref}>Back to course</Link><p className="eyebrow">{snapshot.course.title}</p><h1>{current.title}</h1></header><div className="lesson-player-layout"><aside className="lesson-player-nav" aria-label="Course lessons">{snapshot.modules.map((module) => <section key={module.id}><h2>{module.title}</h2><ol>{module.lessons.map((lesson) => <li key={lesson.id}><Link className={`lesson-navigation-link${lesson.completed ? " is-completed" : ""}`} href={`${courseHref}/lessons/${lesson.id}`} aria-current={lesson.current ? "page" : undefined}><span>{lesson.title}</span><small>{lesson.current ? "Current lesson" : lesson.completed ? "Completed" : lesson.type === "video" ? "Video" : lesson.type === "text" ? "Text" : lesson.type === "quiz" ? "Quiz" : "Coming later"}</small></Link></li>)}</ol></section>)}</aside><article className="lesson-player-content"><p className="eyebrow">{current.type === "video" ? "Video lesson" : current.type === "text" ? "Text lesson" : current.type === "quiz" ? "Quiz assessment" : "Lesson unavailable"}</p>{current.type === "video" ? current.videoProvider === "youtube" && current.videoReference ? <div className="lesson-video"><iframe src={youtubeEmbed(current.videoReference)} title={current.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div> : <p className="lesson-unavailable">This video reference is unavailable.</p> : current.type === "text" ? <div className="lesson-text-content">{current.textContent || "This lesson content is unavailable."}</div> : current.type === "quiz" && quiz ? <QuizPlayer quiz={quiz} slug={slug} lessonId={current.id} nextHref={nextHref} courseHref={courseHref} /> : <p className="lesson-unavailable">This lesson type is not available in the player yet.</p>}{course.enrollmentStatus === "completed" && <p className="lesson-complete-state" role="status">Course completed. Your certificate is available from the course page.</p>}{(current.type === "video" || current.type === "text") && <LessonCompleteButton courseId={snapshot.course.id} lessonId={current.id} completed={current.completed} />}<nav className="lesson-pagination" aria-label="Lesson navigation">{current.previousId ? <Link className="button button-secondary" href={`${courseHref}/lessons/${current.previousId}`}>Previous lesson</Link> : <span />}{current.type !== "quiz" && current.nextId && !isFinalEligibleLesson ? <Link className="button button-primary" href={nextHref!}>Next lesson</Link> : current.type !== "quiz" ? <Link className="button button-primary" href={courseHref}>{course.enrollmentStatus === "completed" ? "View completed course" : "Back to course"}</Link> : null}</nav></article></div></section>;
}
