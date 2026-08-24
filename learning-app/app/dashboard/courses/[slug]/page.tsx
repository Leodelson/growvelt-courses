import Link from "next/link";
import { notFound } from "next/navigation";
import { EnrollmentButton } from "@/app/components/learning/enrollment-button";
import { SaveCourseButton } from "@/app/components/learning/save-course-button";
import { CourseVideoCover } from "@/app/components/course-video-cover";
import { getPublishedLearningCourse } from "@/app/lib/catalog/published-courses";
import { getEnrollmentState } from "@/app/lib/learning/enrollments";
import { getOwnSavedLearningCourseIds } from "@/app/lib/learning/saved-courses";

export const metadata = { title: "Course" };

function formatDuration(seconds: number | null) {
  return seconds ? `${Math.max(1, Math.round(seconds / 60))} min` : null;
}

function lessonLabel(type: "video" | "text" | "quiz" | "project") {
  if (type === "video") return "Video lesson";
  if (type === "text") return "Text lesson";
  if (type === "quiz") return "Quiz";
  return "Project · Coming later";
}

export default async function PublishedCourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slug || slug.length > 220) notFound();
  const course = await getPublishedLearningCourse(slug);
  if (!course) notFound();
  const [enrollment, savedCourseIds] = await Promise.all([getEnrollmentState(course.id), getOwnSavedLearningCourseIds()]);
  const pricing = course.isFree ? "Free" : `${course.priceCurrency || "NGN"} ${Number(course.priceAmount ?? 0).toLocaleString("en-NG")}`;
  const activityCount = course.modules.reduce((total, module) => total + module.lessons.filter((lesson) => lesson.type !== "project").length, 0);
  const paidCheckoutEnabled = process.env.PAYSTACK_MODE === "test" && process.env.PAYMENTS_CHECKOUT_ENABLED === "true";

  return <section className="published-course-page section-shell">
    <header className="published-course-hero">
      <Link className="back-link" href="/dashboard/explore">Explore catalog</Link>
      <p className="eyebrow">{course.category || "Growvelt Learning"}</p>
      <h1>{course.title}</h1>
      <p className="published-course-summary">{course.summary || "A practical Growvelt Learning course."}</p>
      <div className="published-course-meta"><span>{course.level || "All levels"}</span><span>{pricing}</span><span>{course.instructorName ? `By ${course.instructorName}` : "Growvelt Instructor"}</span></div>
      <div className="published-course-video-cover">
        <div className="published-course-video-cover-fallback" aria-hidden="true"><span>Growvelt Learning</span><strong>{course.category || "Practical learning"}</strong></div>
        <CourseVideoCover courseId={course.id} alt="" loading="eager" />
      </div>
    </header>
    <div className="published-course-layout">
      <article className="published-course-content">
        <section><p className="eyebrow">Course overview</p><h2>About this course</h2><p className="published-course-description">{course.description || "A focused learning experience designed to help you build practical skills."}</p></section>
        <section>
          <div className="published-outline-heading"><div><p className="eyebrow">Course outline</p><h2>What you’ll explore</h2></div><p>{activityCount} {activityCount === 1 ? "learning activity" : "learning activities"}</p></div>
          {course.modules.length === 0 ? <p className="published-outline-empty">The course outline is being prepared.</p> : <ol className="published-outline">{course.modules.map((module, moduleIndex) => <li key={module.id}>
            <h3>{String(moduleIndex + 1).padStart(2, "0")} · {module.title}</h3>
            {module.lessons.length ? <ol>{module.lessons.map((lesson, lessonIndex) => <li className={`published-outline-lesson is-${lesson.type}`} key={lesson.id}><span>{lessonIndex + 1}. {lesson.title}</span><small>{lessonLabel(lesson.type)}{lesson.isPreview ? " · Preview" : ""}{lesson.isPreview && lesson.preview ? ` · ${formatDuration(lesson.preview.durationSeconds) || "Preview"}` : ""}</small></li>)}</ol> : <p className="published-outline-empty">No lessons have been added to this module yet.</p>}
          </li>)}</ol>}
        </section>
      </article>
      <aside className="published-course-aside">
        <div className="published-course-save"><SaveCourseButton courseId={course.id} authenticated isSaved={savedCourseIds.includes(course.id)} /><span>Save course</span></div>
        <p className="eyebrow">Course access</p>
        <h2>{enrollment.isEnrolled ? "You’re enrolled" : course.isFree ? "Start learning for free" : paidCheckoutEnabled ? "Purchase this course securely" : "Paid access is coming later"}</h2>
        <p>{enrollment.isEnrolled ? "Open My Learning to continue lessons, complete quizzes, and follow your saved course progress." : course.isFree ? "Enroll to access the lesson player, complete text and video lessons, take quizzes, and track your progress." : paidCheckoutEnabled ? "Complete a Paystack test-mode checkout. Access is granted only after Growvelt verifies the payment event." : "Growvelt has not enabled paid enrollment or checkout yet."}</p>
        <EnrollmentButton courseId={course.id} slug={course.slug} isFree={course.isFree} isEnrolled={enrollment.isEnrolled} paidCheckoutEnabled={paidCheckoutEnabled} />
        <Link className="text-link" href="/dashboard/explore">Browse more courses</Link>
      </aside>
    </div>
  </section>;
}
