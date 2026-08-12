import Link from "next/link";
import { listOwnLearningEnrollments } from "@/app/lib/learning/enrollments";

export const metadata = { title: "My Learning" };

export default async function MyLearningPage() {
  const courses = await listOwnLearningEnrollments();

  if (courses.length === 0) {
    return <section className="certificate-space" aria-labelledby="my-learning-title"><p className="eyebrow">My Learning</p><h1 id="my-learning-title">Your enrolled courses will appear here.</h1><p>Enroll in a published free course to begin learning and track your progress here.</p><div className="certificate-space-actions"><Link className="button button-primary" href="/dashboard/explore">Explore published courses</Link><Link className="text-link" href="/dashboard">Back to dashboard <span aria-hidden="true">→</span></Link></div></section>;
  }

  return <section className="my-learning-page section-shell" aria-labelledby="my-learning-title"><header className="catalog-hero"><p className="eyebrow">My Learning</p><h1 id="my-learning-title">Your enrolled courses</h1><p>Progress is based on lessons you have explicitly completed.</p></header><div className="my-learning-list">{courses.map((course) => {
    const resumeHref = course.resumeLessonId ? `/dashboard/my-learning/${encodeURIComponent(course.slug)}/lessons/${course.resumeLessonId}` : `/dashboard/my-learning/${encodeURIComponent(course.slug)}`;
    const actionLabel = course.resumeLessonId ? "Continue learning" : course.enrollmentStatus === "completed" ? "Review course" : "View course";
    return <article className="my-learning-card" key={course.id}><div><p className="eyebrow">{course.category || "Growvelt Learning"}</p><h2>{course.title}</h2><p>{course.summary || "A practical Growvelt Learning course."}</p><div className="published-course-meta"><span>{course.level || "All levels"}</span><span>Free</span><span>{course.instructorName ? `By ${course.instructorName}` : "Growvelt Instructor"}</span></div><div className="learning-progress" aria-label={`${course.progressPercent}% complete`}><div className="progress-track" aria-hidden="true"><span style={{ width: `${course.progressPercent}%` }} /></div><small>{course.completedLessons} of {course.totalLessons} eligible lessons · {course.progressPercent}%{course.enrollmentStatus === "completed" ? " · Completed" : ""}</small></div><small>Enrolled {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(course.enrolledAt))}</small></div><Link className="button button-primary" href={resumeHref}>{actionLabel}</Link></article>;
  })}</div></section>;
}
