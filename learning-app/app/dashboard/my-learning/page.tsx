import Link from "next/link";
import { listOwnLearningEnrollments } from "@/app/lib/learning/enrollments";

export const metadata = { title: "My Learning" };

export default async function MyLearningPage() {
  const courses = await listOwnLearningEnrollments();

  if (courses.length === 0) {
    return <section className="certificate-space learner-empty-space" aria-labelledby="my-learning-title"><div><p className="eyebrow">My Learning</p><h1 id="my-learning-title">Your enrolled courses will appear here.</h1><p>Enroll in a published free course to begin learning and track your progress here.</p></div><div className="learner-empty-highlight"><span aria-hidden="true">↗</span><div><strong>Learn at your pace</strong><p>Your next lesson, quiz progress, completion state, and certificate path will stay connected here.</p></div></div><div className="certificate-space-actions"><Link className="button button-primary" href="/dashboard/explore">Explore published courses</Link><Link className="text-link" href="/dashboard">Back to dashboard <span aria-hidden="true">→</span></Link></div></section>;
  }

  const completedCourses = courses.filter((course) => course.enrollmentStatus === "completed").length;
  const completedActivities = courses.reduce((total, course) => total + course.completedLessons, 0);
  const totalActivities = courses.reduce((total, course) => total + course.totalLessons, 0);

  return <section className="my-learning-page section-shell" aria-labelledby="my-learning-title"><header className="my-learning-hero"><div><p className="eyebrow">My Learning</p><h1 id="my-learning-title">Your enrolled courses</h1><p>Continue structured text, video, and quiz activities using progress saved securely to your account.</p></div><Link className="button button-primary" href="/dashboard/explore">Explore more courses</Link></header><div className="my-learning-summary" aria-label="My Learning summary"><span><strong>{courses.length}</strong> enrolled</span><span><strong>{completedCourses}</strong> completed</span><span><strong>{completedActivities}/{totalActivities}</strong> activities</span></div><div className="my-learning-list">{courses.map((course) => {
    const resumeHref = course.resumeLessonId ? `/dashboard/my-learning/${encodeURIComponent(course.slug)}/lessons/${course.resumeLessonId}` : `/dashboard/my-learning/${encodeURIComponent(course.slug)}`;
    const actionLabel = course.resumeLessonId ? "Continue learning" : course.enrollmentStatus === "completed" ? "Review course" : "View course";
    return <article className="my-learning-card" key={course.id}><div className="my-learning-card-content"><div className="my-learning-card-status"><span className={`learner-status-pill${course.enrollmentStatus === "completed" ? " is-complete" : ""}`}>{course.enrollmentStatus === "completed" ? "Completed" : course.progressPercent > 0 ? "In progress" : "Ready to begin"}</span><span>{course.progressPercent}%</span></div><p className="eyebrow">{course.category || "Growvelt Learning"}</p><h2>{course.title}</h2><p>{course.summary || "A practical Growvelt Learning course."}</p><div className="published-course-meta"><span>{course.level || "All levels"}</span><span>{course.isFree ? "Free" : "Paid"}</span><span>{course.instructorName ? `By ${course.instructorName}` : "Growvelt Instructor"}</span></div><div className="learning-progress" aria-label={`${course.progressPercent}% complete`}><div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={course.progressPercent}><span style={{ width: `${course.progressPercent}%` }} /></div><small>{course.completedLessons} of {course.totalLessons} text, video, and quiz activities · {course.progressPercent}%</small></div><small>Enrolled {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(course.enrolledAt))}</small></div><div className="my-learning-card-action"><Link className="button button-primary learner-arrow-action" href={resumeHref}>{actionLabel}<span aria-hidden="true">→</span></Link><Link className="text-link" href={`/dashboard/my-learning/${encodeURIComponent(course.slug)}`}>Course details</Link></div></article>;
  })}</div><div className="results-end-marker my-learning-end-marker">End of My Learning</div></section>;
}
