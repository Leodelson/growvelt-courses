import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonCompleteButton } from "@/app/components/learning/lesson-complete-button";
import { getOwnEnrolledLessonSnapshot } from "@/app/lib/learning/lesson-player";

export const metadata = { title: "Lesson" };

function youtubeEmbed(reference: string) {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(reference)}`;
}

export default async function EnrolledLessonPage({ params }: { params: Promise<{ slug: string; lessonId: string }> }) {
  const { slug, lessonId } = await params;
  const parsedLessonId = Number(lessonId);
  if (!slug || slug.length > 220 || !Number.isSafeInteger(parsedLessonId) || parsedLessonId < 1) notFound();
  const snapshot = await getOwnEnrolledLessonSnapshot(slug, parsedLessonId);
  if (!snapshot) notFound();
  const { current } = snapshot;
  return <section className="lesson-player-page section-shell"><header className="lesson-player-heading"><Link className="back-link" href={`/dashboard/my-learning/${encodeURIComponent(snapshot.course.slug)}`}>Back to course</Link><p className="eyebrow">{snapshot.course.title}</p><h1>{current.title}</h1></header><div className="lesson-player-layout"><aside className="lesson-player-nav" aria-label="Course lessons">{snapshot.modules.map((module) => <section key={module.id}><h2>{module.title}</h2><ol>{module.lessons.map((lesson) => <li key={lesson.id}><Link href={`/dashboard/my-learning/${encodeURIComponent(snapshot.course.slug)}/lessons/${lesson.id}`} aria-current={lesson.current ? "page" : undefined}><span>{lesson.title}</span><small>{lesson.completed ? "Complete" : lesson.type === "video" ? "Video" : lesson.type === "text" ? "Text" : "Coming later"}</small></Link></li>)}</ol></section>)}</aside><article className="lesson-player-content"><p className="eyebrow">{current.type === "video" ? "Video lesson" : current.type === "text" ? "Text lesson" : "Lesson unavailable"}</p>{current.type === "video" ? current.videoProvider === "youtube" && current.videoReference ? <div className="lesson-video"><iframe src={youtubeEmbed(current.videoReference)} title={current.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div> : <p className="lesson-unavailable">This video reference is unavailable.</p> : current.type === "text" ? <div className="lesson-text-content">{current.textContent || "This lesson content is unavailable."}</div> : <p className="lesson-unavailable">This lesson type is not available in the player yet.</p>}<LessonCompleteButton courseId={snapshot.course.id} lessonId={current.id} completed={current.completed} /><nav className="lesson-pagination" aria-label="Lesson navigation">{current.previousId ? <Link className="button button-secondary" href={`/dashboard/my-learning/${encodeURIComponent(snapshot.course.slug)}/lessons/${current.previousId}`}>Previous lesson</Link> : <span />}{current.nextId ? <Link className="button button-primary" href={`/dashboard/my-learning/${encodeURIComponent(snapshot.course.slug)}/lessons/${current.nextId}`}>Next lesson</Link> : <Link className="button button-primary" href={`/dashboard/my-learning/${encodeURIComponent(snapshot.course.slug)}`}>Back to course</Link>}</nav></article></div></section>;
}
