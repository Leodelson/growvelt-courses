import Link from "next/link";
import { listOwnCertificates } from "@/app/lib/learning/certificates";
import { listOwnLearningEnrollments } from "@/app/lib/learning/enrollments";

export const metadata = { title: "Overview" };

const dateFormatter = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" });

export default async function DashboardPage() {
  const [courses, certificates] = await Promise.all([
    listOwnLearningEnrollments(),
    listOwnCertificates(),
  ]);

  const resumableCourse = courses.find((course) => course.resumeLessonId !== null);
  const reviewableCourse = courses.find((course) => course.enrollmentStatus === "completed");
  const featuredCourse = resumableCourse ?? reviewableCourse ?? courses[0] ?? null;
  const issuedCertificates = certificates.filter((certificate) => certificate.status === "issued");
  const completedCourses = courses.filter((course) => course.enrollmentStatus === "completed").length;
  const completedActivities = courses.reduce((total, course) => total + course.completedLessons, 0);
  const totalActivities = courses.reduce((total, course) => total + course.totalLessons, 0);

  const featuredHref = featuredCourse
    ? featuredCourse.resumeLessonId
      ? `/dashboard/my-learning/${encodeURIComponent(featuredCourse.slug)}/lessons/${featuredCourse.resumeLessonId}`
      : `/dashboard/my-learning/${encodeURIComponent(featuredCourse.slug)}`
    : "/dashboard/explore";
  const featuredAction = featuredCourse?.resumeLessonId
    ? featuredCourse.progressPercent > 0
      ? "Continue learning"
      : "Start course"
    : featuredCourse?.enrollmentStatus === "completed"
      ? "Review course"
      : "View course";

  return <section className="learner-overview" aria-labelledby="learner-overview-title">
    <header className="learner-overview-hero">
      <div>
        <p className="eyebrow">Learning overview</p>
        <h1 id="learner-overview-title">Build skills. Track progress. Earn proof.</h1>
        <p>Your Growvelt Learning space brings together enrolled courses, completed activities, quiz progress, and issued certificates.</p>
      </div>
      <div className="learner-overview-actions">
        <Link className="button button-primary" href="/dashboard/explore">Explore courses</Link>
        {courses.length > 0 && <Link className="button button-secondary" href="/dashboard/my-learning">View My Learning</Link>}
      </div>
    </header>

    {featuredCourse ? <section className="learner-continue-panel" aria-labelledby="continue-title">
      <div className="learner-continue-copy">
        <div className="learner-status-row">
          <span className={`learner-status-pill${featuredCourse.enrollmentStatus === "completed" ? " is-complete" : ""}`}>
            {featuredCourse.enrollmentStatus === "completed" ? "Completed" : featuredCourse.progressPercent > 0 ? "In progress" : "Ready to begin"}
          </span>
          <span>{featuredCourse.category || "Growvelt Learning"}</span>
        </div>
        <p className="eyebrow">{featuredCourse.resumeLessonId ? "Continue where you left off" : "Your latest course"}</p>
        <h2 id="continue-title">{featuredCourse.title}</h2>
        <p>{featuredCourse.summary || "Continue building practical knowledge through structured lessons and assessments."}</p>
        <div className="learner-course-meta">
          <span>{featuredCourse.level || "All levels"}</span>
          <span>{featuredCourse.instructorName ? `By ${featuredCourse.instructorName}` : "Growvelt Instructor"}</span>
        </div>
      </div>
      <div className="learner-continue-progress">
        <strong>{featuredCourse.progressPercent}%</strong>
        <span>course progress</span>
        <div className="progress-track" role="progressbar" aria-label={`${featuredCourse.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={featuredCourse.progressPercent}>
          <span style={{ width: `${featuredCourse.progressPercent}%` }} />
        </div>
        <small>{featuredCourse.completedLessons} of {featuredCourse.totalLessons} learning activities complete</small>
        <Link className="button button-primary learner-arrow-action" href={featuredHref}>{featuredAction}<span aria-hidden="true">→</span></Link>
      </div>
    </section> : <section className="learner-welcome-panel" aria-labelledby="learning-start-title">
      <div>
        <p className="eyebrow">Your learning journey starts here</p>
        <h2 id="learning-start-title">Choose a published course and begin building practical skills.</h2>
        <p>You have not enrolled in a course yet. Explore Growvelt Learning and add your first available course to this dashboard.</p>
      </div>
      <Link className="button button-primary" href="/dashboard/explore">Browse published courses</Link>
    </section>}

    <section className="learner-stat-grid" aria-label="Your learning statistics">
      <article><span className="learner-stat-icon" aria-hidden="true">◫</span><strong>{courses.length}</strong><p>Enrolled {courses.length === 1 ? "course" : "courses"}</p></article>
      <article><span className="learner-stat-icon" aria-hidden="true">✓</span><strong>{completedCourses}</strong><p>Completed {completedCourses === 1 ? "course" : "courses"}</p></article>
      <article><span className="learner-stat-icon" aria-hidden="true">↗</span><strong>{completedActivities}<small> / {totalActivities}</small></strong><p>Activities completed</p></article>
      <article><span className="learner-stat-icon" aria-hidden="true">◇</span><strong>{issuedCertificates.length}</strong><p>Issued {issuedCertificates.length === 1 ? "certificate" : "certificates"}</p></article>
    </section>

    <section id="my-learning" className="learner-dashboard-section" aria-labelledby="current-learning-title">
      <div className="learner-section-heading">
        <div><p className="eyebrow">My Learning</p><h2 id="current-learning-title">Your courses at a glance</h2></div>
        {courses.length > 0 && <Link className="text-link" href="/dashboard/my-learning">View all courses <span aria-hidden="true">→</span></Link>}
      </div>
      {courses.length > 0 ? <div className="learner-course-grid">{courses.slice(0, 4).map((course) => {
        const courseHref = course.resumeLessonId
          ? `/dashboard/my-learning/${encodeURIComponent(course.slug)}/lessons/${course.resumeLessonId}`
          : `/dashboard/my-learning/${encodeURIComponent(course.slug)}`;
        const action = course.resumeLessonId ? course.progressPercent > 0 ? "Continue" : "Start" : course.enrollmentStatus === "completed" ? "Review" : "View course";
        return <article className="learner-course-card" key={course.id}>
          <div className="learner-course-card-top">
            <span className={`learner-status-pill${course.enrollmentStatus === "completed" ? " is-complete" : ""}`}>{course.enrollmentStatus === "completed" ? "Completed" : "Active"}</span>
            <span>{course.progressPercent}%</span>
          </div>
          <div><p className="eyebrow">{course.category || "Growvelt Learning"}</p><h3>{course.title}</h3><p>{course.summary || "A practical Growvelt Learning course."}</p></div>
          <div className="learner-card-progress">
            <div className="progress-track" role="progressbar" aria-label={`${course.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={course.progressPercent}><span style={{ width: `${course.progressPercent}%` }} /></div>
            <small>{course.completedLessons} of {course.totalLessons} activities</small>
          </div>
          <Link className="button button-secondary learner-arrow-action" href={courseHref}>{action}<span aria-hidden="true">→</span></Link>
        </article>;
      })}</div> : <div className="learner-inline-empty"><p>No enrolled courses yet.</p><Link className="text-link" href="/dashboard/explore">Find your first course <span aria-hidden="true">→</span></Link></div>}
    </section>

    <section className="learner-dashboard-section learner-proof-panel" aria-labelledby="proof-title">
      <div>
        <p className="eyebrow">Verified achievement</p>
        <h2 id="proof-title">Turn completed learning into trusted proof.</h2>
        <p>Complete every required text, video, and quiz activity to unlock the existing secure certificate flow for an eligible course.</p>
      </div>
      {issuedCertificates[0] ? <article className="learner-latest-certificate">
        <span className="learner-proof-mark" aria-hidden="true">◇</span>
        <div><small>Latest issued certificate</small><h3>{issuedCertificates[0].courseTitle}</h3><p>Issued {dateFormatter.format(new Date(issuedCertificates[0].issuedAt))}</p></div>
        <Link className="button button-secondary" href={`/dashboard/certificates/${encodeURIComponent(issuedCertificates[0].code)}`}>View certificate</Link>
      </article> : <div className="learner-proof-action"><p>Your issued certificates will appear here after you complete and claim them.</p><Link className="button button-secondary" href={completedCourses > 0 ? "/dashboard/my-learning" : "/dashboard/certificates"}>{completedCourses > 0 ? "View completed courses" : "Open certificates"}</Link></div>}
    </section>
  </section>;
}
