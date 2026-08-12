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
  const firstLesson = course.modules.flatMap((module) => module.lessons)[0];
  const { data } = course.enrollmentStatus === "completed" ? await (await createClient()).rpc("get_own_learning_certificate_state", { p_course_id: course.id }) : { data: [] };
  const certificate = data?.[0] as { is_eligible: boolean; certificate_code: string | null } | undefined;
  const actionLabel = course.progressPercent === 100 ? "Review course" : course.progressPercent > 0 ? "Continue learning" : "Start course";
  return <section className="published-course-page enrolled-course-page section-shell"><header className="published-course-hero"><Link className="back-link" href="/dashboard/my-learning">My Learning</Link><p className="eyebrow">Enrolled course</p><h1>{course.title}</h1><p className="published-course-summary">{course.summary || "A practical Growvelt Learning course."}</p></header><div className="published-course-layout"><article className="published-course-content"><section><h2>About this course</h2><p className="published-course-description">{course.description || "Course details will be expanded as Growvelt Learning grows."}</p></section><section><div className="published-outline-heading"><div><p className="eyebrow">Course outline</p><h2>Your learning path</h2></div><p>{course.completedLessons} of {course.totalLessons} lessons completed.</p></div><ol className="published-outline">{course.modules.map((module, moduleIndex) => <li key={module.id}><h3>{String(moduleIndex + 1).padStart(2, "0")} · {module.title}</h3><ol>{module.lessons.map((lesson, lessonIndex) => <li key={lesson.id}><Link href={`/dashboard/my-learning/${encodeURIComponent(course.slug)}/lessons/${lesson.id}`}><span>{lessonIndex + 1}. {lesson.title}</span><small>{lesson.type === "video" ? "Video" : "Text lesson"}</small></Link></li>)}</ol></li>)}</ol></section></article><aside className="published-course-aside"><p className="eyebrow">{course.enrollmentStatus === "completed" ? "Course completed" : "Learning progress"}</p><h2>{course.progressPercent}% complete</h2><div className="learning-progress"><div className="progress-track" aria-hidden="true"><span style={{ width: `${course.progressPercent}%` }} /></div><p>{course.completedLessons} of {course.totalLessons} lessons completed.</p></div>{certificate?.certificate_code ? <Link className="button button-secondary" href={`/dashboard/certificates/${encodeURIComponent(certificate.certificate_code)}`}>View certificate</Link> : certificate?.is_eligible ? <CertificateIssueButton courseId={course.id} /> : null}{firstLesson ? <Link className="button button-primary" href={`/dashboard/my-learning/${encodeURIComponent(course.slug)}/lessons/${firstLesson.id}`}>{actionLabel}</Link> : <Link className="button button-primary" href="/dashboard/my-learning">Back to My Learning</Link>}<Link className="text-link" href="/dashboard/explore">Explore more courses</Link></aside></div></section>;
}
