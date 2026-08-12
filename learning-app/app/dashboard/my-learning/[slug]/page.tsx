import Link from "next/link";
import { notFound } from "next/navigation";
import { CertificateIssueButton } from "@/app/components/learning/certificate-issue-button";
import { getOwnEnrolledLearningCourse } from "@/app/lib/learning/enrollments";
import { createClient } from "@/app/lib/supabase/server";

export const metadata = { title: "My Learning" };

export default async function EnrolledCoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slug || slug.length > 220) notFound();
  const course = await getOwnEnrolledLearningCourse(slug);
  if (!course) notFound();

  const firstEligibleLesson = course.modules.flatMap((module) => module.lessons).find((lesson) => lesson.type === "text" || lesson.type === "video");
  const primaryLessonId = course.resumeLessonId ?? firstEligibleLesson?.id ?? null;
  const primaryLabel = course.resumeLessonId ? "Continue learning" : course.enrollmentStatus === "completed" ? "Review course" : "Start course";
  const { data } = course.enrollmentStatus === "completed"
    ? await (await createClient()).rpc("get_own_learning_certificate_state", { p_course_id: course.id })
    : { data: [] };
  const certificate = data?.[0] as { is_eligible: boolean; certificate_code: string | null } | undefined;

  return <section className="published-course-page enrolled-course-page section-shell"><header className="published-course-hero"><Link className="back-link" href="/dashboard/my-learning">My Learning</Link><p className="eyebrow">Enrolled course</p><h1>{course.title}</h1><p className="published-course-summary">{course.summary || "A practical Growvelt Learning course."}</p></header><div className="published-course-layout"><article className="published-course-content"><section><h2>About this course</h2><p className="published-course-description">{course.description || "Course details will be expanded as Growvelt Learning grows."}</p></section><section><div className="published-outline-heading"><div><p className="eyebrow">Course outline</p><h2>Your learning path</h2></div><p>{course.completedLessons} of {course.totalLessons} eligible lessons completed · {course.progressPercent}%</p></div>{course.modules.length ? <ol className="published-outline">{course.modules.map((module, moduleIndex) => <li key={module.id}><h3>{String(moduleIndex + 1).padStart(2, "0")} · {module.title}</h3>{module.lessons.length ? <ol>{module.lessons.map((lesson, lessonIndex) => <li key={lesson.id}><Link href={`/dashboard/my-learning/${encodeURIComponent(course.slug)}/lessons/${lesson.id}`}><span>{lessonIndex + 1}. {lesson.title}</span><small>{lesson.completed ? "Completed" : lesson.type === "video" ? "Video" : lesson.type === "text" ? "Text lesson" : "Coming later"}</small></Link></li>)}</ol> : <p className="published-outline-empty">No lessons have been added to this module yet.</p>}</li>)}</ol> : <p className="published-outline-empty">This course does not have any modules yet.</p>}</section></article><aside className="published-course-aside"><p className="eyebrow">{course.enrollmentStatus === "completed" ? "Course completed" : course.totalLessons === 0 ? "Learning path unavailable" : "Learning progress"}</p><h2>{course.progressPercent}% complete</h2><div className="learning-progress"><div className="progress-track" aria-hidden="true"><span style={{ width: `${course.progressPercent}%` }} /></div><p>{course.completedLessons} of {course.totalLessons} eligible lessons completed.</p></div>{course.enrollmentStatus === "completed" && <p className="lesson-complete-state" role="status">Course completed. Your certificate is ready when you are.</p>}{course.totalLessons === 0 && <p className="lesson-unavailable">There are no eligible text or video lessons to complete yet.</p>}{certificate?.certificate_code ? <Link className="button button-secondary" href={`/dashboard/certificates/${encodeURIComponent(certificate.certificate_code)}`}>View certificate</Link> : certificate?.is_eligible ? <CertificateIssueButton courseId={course.id} /> : null}{primaryLessonId ? <Link className="button button-primary" href={`/dashboard/my-learning/${encodeURIComponent(course.slug)}/lessons/${primaryLessonId}`}>{primaryLabel}</Link> : <Link className="button button-primary" href="/dashboard/my-learning">Back to My Learning</Link>}<Link className="text-link" href="/dashboard/explore">Explore more courses</Link></aside></div></section>;
}
