import Link from "next/link";
import { redirect } from "next/navigation";
import { getOwnInstructorLearningAnalytics } from "@/app/lib/instructor/analytics";
import { isApprovedInstructor } from "@/app/lib/instructor/authorization";

export const metadata = { title: "Instructor workspace" };

function statusLabel(status: "draft" | "pending_review" | "published" | "archived") {
  return status === "pending_review" ? "Pending review" : status.charAt(0).toUpperCase() + status.slice(1);
}

export default async function DashboardInstructorPage() {
  if (!(await isApprovedInstructor())) redirect("/teach");

  const analytics = await getOwnInstructorLearningAnalytics();
  const publishedCourses = analytics.courses.filter((course) => course.status === "published").length;

  return <section className="instructor-analytics-page section-shell">
    <header className="instructor-analytics-hero">
      <div>
        <p className="eyebrow">Instructor Learning Analytics</p>
        <h1>See how your learning experiences are progressing.</h1>
        <p>Track course enrollment, completion, and quiz engagement from authoritative Learning records. Individual learner answers remain private.</p>
      </div>
      <div className="workspace-actions">
        <Link className="button button-secondary" href="/dashboard/instructor/courses">My Courses</Link>
        <Link className="button button-primary" href="/dashboard/instructor/courses/new">Create Course</Link>
      </div>
    </header>

    <section className="instructor-analytics-summary" aria-label="Instructor Learning Analytics summary">
      <article><span>Courses</span><strong>{analytics.courses.length}</strong><small>{publishedCourses} published</small></article>
      <article><span>Enrolled learners</span><strong>{analytics.totalEnrolledLearners}</strong><small>{analytics.totalCompletedLearners} completed</small></article>
      <article><span>Completion rate</span><strong>{analytics.overallCompletionRate}%</strong><small>Across active and completed enrollments</small></article>
      <article><span>Quiz attempts</span><strong>{analytics.totalQuizAttempts}</strong><small>Passed attempts and scores appear per course</small></article>
    </section>

    {analytics.courses.length > 0 ? <section className="instructor-analytics-courses" aria-label="Course performance">
      <header><div><p className="eyebrow">Course performance</p><h2>Progress across your courses</h2></div><p>Metrics are aggregate-only and update as learners make progress.</p></header>
      <div className="instructor-analytics-course-list">
        {analytics.courses.map((course) => <article key={course.courseId}>
          <div className="instructor-analytics-course-heading">
            <div><span className={`course-status-badge is-${course.status}`}>{statusLabel(course.status)}</span><h3>{course.title}</h3></div>
            <Link className="button button-secondary" href={`/dashboard/instructor/courses/${course.courseId}`}>View course</Link>
          </div>
          <dl>
            <div><dt>Enrolled</dt><dd>{course.enrolledLearnerCount}</dd></div>
            <div><dt>Active</dt><dd>{course.activeLearnerCount}</dd></div>
            <div><dt>Completed</dt><dd>{course.completedLearnerCount}</dd></div>
            <div><dt>Completion</dt><dd>{course.completionRate}%</dd></div>
          </dl>
          <div className="instructor-analytics-progress" aria-label={`${course.completionRate}% course completion`}><span style={{ width: `${course.completionRate}%` }} /></div>
          {course.quizCount > 0 ? <div className="instructor-quiz-insight"><span>{course.quizCount} {course.quizCount === 1 ? "quiz" : "quizzes"}</span><span>{course.quizAttemptCount} attempts</span><span>{course.quizAttemptPassRate}% attempt pass rate</span><span>{course.averageQuizScore}% average score</span></div> : <p className="instructor-analytics-empty-note">No quiz lessons in this course yet.</p>}
        </article>)}
      </div>
    </section> : <section className="instructor-analytics-empty">
      <p className="eyebrow">No course analytics yet</p>
      <h2>Create your first course to begin.</h2>
      <p>Once a course is published and learners enroll, this workspace will show its enrollment, completion, and quiz engagement metrics.</p>
      <Link className="button button-primary" href="/dashboard/instructor/courses/new">Create Course</Link>
    </section>}
  </section>;
}
