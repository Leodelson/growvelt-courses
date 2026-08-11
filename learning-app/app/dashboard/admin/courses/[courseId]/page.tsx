import { notFound, redirect } from "next/navigation";
import { CourseModerationForm } from "@/app/components/admin/course-moderation-form";
import { getLearningCourseForReview } from "@/app/lib/admin/course-moderation";
import { isLearningAdmin } from "@/app/lib/admin/authorization";

export const metadata = { title: "Review course" };

function formatDuration(seconds: number | null) {
  return seconds ? `${Math.round(seconds / 60)} min` : "Duration not supplied";
}

export default async function AdminCourseDetailPage({ params }: { params: Promise<{ courseId: string }> }) {
  if (!await isLearningAdmin()) redirect("/dashboard");
  const { courseId } = await params;
  const id = Number(courseId);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const course = await getLearningCourseForReview(id);
  if (!course) notFound();
  const submitted = course.submittedAt ? new Intl.DateTimeFormat("en", { dateStyle: "long", timeStyle: "short" }).format(new Date(course.submittedAt)) : "Submission date unavailable";

  return <section className="admin-page section-shell"><header className="admin-page-header"><p className="eyebrow">Course review</p><h1>{course.title}</h1><p>Submitted {submitted}</p></header><div className="admin-detail-grid"><article className="admin-application-detail course-review-detail"><div><p className="eyebrow">Instructor</p><p className="admin-identity"><strong>{course.instructor.name || "Name unavailable"}</strong><span>{course.instructor.email || "Email unavailable"}</span></p></div><div><p className="eyebrow">Course metadata</p><p><strong>{course.category || "Uncategorized"}</strong> · {course.level || "Level not set"} · {course.isFree ? "Free" : `${course.priceCurrency || "NGN"} ${Number(course.priceAmount ?? 0).toLocaleString("en-NG")}`}</p><p>{course.summary || "No summary supplied."}</p><p className="admin-bio">{course.description || "No description supplied."}</p></div><div><p className="eyebrow">Rights declaration</p><p>{course.declaration.version || "Declaration unavailable"} · {course.declaration.basis || "Basis unavailable"}</p><p>{course.declaration.acceptedAt ? `Accepted ${new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(course.declaration.acceptedAt))}` : "Acceptance time unavailable"}</p></div><div><p className="eyebrow">Curriculum</p><div className="course-review-curriculum">{course.modules.map((module, moduleIndex) => <section key={module.id}><h2>{String(moduleIndex + 1).padStart(2, "0")} · {module.title}</h2>{module.lessons.map((lesson, lessonIndex) => <article key={lesson.id}><p><strong>{lessonIndex + 1}. {lesson.title}</strong> · {lesson.type === "video" ? `Video · ${formatDuration(lesson.durationSeconds)}` : "Text lesson"}{lesson.isPreview ? " · Preview" : ""}</p>{lesson.type === "video" ? <p>{lesson.videoProvider || "Provider unavailable"} · {lesson.videoReference || "Reference unavailable"} · {lesson.videoVisibility || "Visibility unavailable"}</p> : <p className="admin-bio">{lesson.content || "No text content supplied."}</p>}</article>)}</section>)}</div></div></article><CourseModerationForm courseId={course.courseId} /></div></section>;
}
