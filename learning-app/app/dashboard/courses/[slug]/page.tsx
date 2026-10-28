import Link from "next/link";
import { notFound } from "next/navigation";
import { EnrollmentButton } from "@/app/components/learning/enrollment-button";
import { SaveCourseButton } from "@/app/components/learning/save-course-button";
import { getPublishedLearningCourse, getRelatedLearningCourses } from "@/app/lib/catalog/published-courses";
import { CourseDetailHeader } from "@/app/components/course-detail-header";
import { CourseShelf } from "@/app/components/course-shelf";
import styles from "@/app/components/course-detail.module.css";
import { getRequestLocale } from "@/app/lib/i18n-server";
import { coursePresentationCopy } from "@/app/lib/catalog/course-presentation-copy";
import { getEnrollmentState } from "@/app/lib/learning/enrollments";
import { getOwnSavedLearningCourseIds } from "@/app/lib/learning/saved-courses";
import { getOwnPaystackTestFixtureEligibility } from "@/app/lib/payments/test-fixture";
import { createClient } from "@/app/lib/supabase/server";
import { canStartTestSubscriptionCheckout } from "@/app/lib/subscriptions/feature";
import { SubscriptionPlanPurchase, type PublicTestSubscriptionPlan } from "@/app/components/learning/subscription-plan-purchase";

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
  const copy = coursePresentationCopy[await getRequestLocale()];
  const paystackMode = process.env.PAYSTACK_MODE === "live" ? "live" : "test";
  const subscriptionsAvailable = canStartTestSubscriptionCheckout() && !course.isFree;
  const [enrollment, savedCourseIds, fixtureEligibility, subscriptionPlanResult, related] = await Promise.all([
    getEnrollmentState(course.id),
    getOwnSavedLearningCourseIds(),
    course.isFree || paystackMode === "live" ? Promise.resolve({ eligible: false }) : getOwnPaystackTestFixtureEligibility(course.id),
    subscriptionsAvailable
      ? createClient().then((client) => client.rpc("list_public_test_learning_subscription_plans_for_course", { p_course_id: course.id }))
      : Promise.resolve({ data: null, error: null }),
    getRelatedLearningCourses(course),
  ]);
  const subscriptionPlans = (subscriptionPlanResult.data ?? []) as PublicTestSubscriptionPlan[];
  const pricing = course.isFree ? "Free" : `${course.priceCurrency || "NGN"} ${Number(course.priceAmount ?? 0).toLocaleString("en-NG")}`;
  const activityCount = course.modules.reduce((total, module) => total + module.lessons.filter((lesson) => lesson.type !== "project").length, 0);
  const checkoutMode = process.env.PAYMENTS_CHECKOUT_ENABLED === "true"
    && paystackMode === "live"
    && process.env.PAYMENTS_LIVE_LEARNER_CHECKOUT_ENABLED === "true"
    ? "live"
    : process.env.PAYMENTS_CHECKOUT_ENABLED === "true" && paystackMode === "test" && fixtureEligibility.eligible
      ? "test"
      : null;
  const paidCheckoutEnabled = checkoutMode !== null;

  return <section className={`published-course-page section-shell ${styles.page}`}>
    <CourseDetailHeader course={course} dashboard />
    <div className="published-course-layout">
      <article className="published-course-content">
        <section id="course-about"><p className="eyebrow">Course overview</p><h2>About this course</h2><p className="published-course-description">{course.description || "A focused learning experience designed to help you build practical skills."}</p></section>
        <section id="course-outline">
          <div className="published-outline-heading"><div><p className="eyebrow">Course outline</p><h2>What you’ll explore</h2></div><p>{activityCount} {activityCount === 1 ? "learning activity" : "learning activities"}</p></div>
          {course.modules.length === 0 ? <p className="published-outline-empty">The course outline is being prepared.</p> : <ol className="published-outline">{course.modules.map((module, moduleIndex) => <li key={module.id}>
            <h3>{String(moduleIndex + 1).padStart(2, "0")} · {module.title}</h3>
            {module.lessons.length ? <ol>{module.lessons.map((lesson, lessonIndex) => <li className={`published-outline-lesson is-${lesson.type}`} key={lesson.id}><span>{lessonIndex + 1}. {lesson.title}</span><small>{lessonLabel(lesson.type)}{lesson.isPreview ? " · Preview" : ""}{lesson.isPreview && lesson.preview ? ` · ${formatDuration(lesson.preview.durationSeconds) || "Preview"}` : ""}</small></li>)}</ol> : <p className="published-outline-empty">No lessons have been added to this module yet.</p>}
          </li>)}</ol>}
        </section>
      </article>
      <aside id="course-access" className="published-course-aside">
        <div className="published-course-save"><SaveCourseButton courseId={course.id} authenticated isSaved={savedCourseIds.includes(course.id)} /><span>Save course</span></div>
        <p className="eyebrow">Course access</p>
        <strong>{pricing}</strong>
        <h2>{enrollment.isEnrolled ? "You’re enrolled" : course.isFree ? "Start learning for free" : paidCheckoutEnabled ? "Purchase this course securely" : "Paid enrollment unavailable"}</h2>
        <p>{enrollment.isEnrolled ? "Open My Courses to continue lessons, complete quizzes, and follow your saved course progress." : course.isFree ? "Enroll to access the lesson player, complete text and video lessons, take quizzes, and track your progress." : paidCheckoutEnabled ? "Complete secure checkout. Access is granted only after Growvelt confirms your payment." : "Paid enrollment is not available for this course."}</p>
        <EnrollmentButton courseId={course.id} slug={course.slug} isFree={course.isFree} isEnrolled={enrollment.isEnrolled} paidCheckoutEnabled={paidCheckoutEnabled} checkoutMode={checkoutMode ?? "test"} displayedPrice={pricing} testCouponCheckoutEnabled={checkoutMode === "test" && process.env.PAYMENTS_TEST_COUPONS_ENABLED === "true"} />
        {subscriptionPlans.length > 0 ? <section className="subscription-plan-offers" aria-label="Private monthly plan previews">
          <p className="eyebrow">More ways to learn</p>
          {subscriptionPlans.map((plan) => <SubscriptionPlanPurchase key={plan.plan_id} plan={plan} />)}
        </section> : null}
        <Link className="text-link" href="/dashboard/explore">Browse more courses</Link>
      </aside>
    </div>
    <div className={styles.recommendations} id="course-recommendations">{related.length ? <CourseShelf title={copy.recommendations} description={copy.related} courses={related} dashboard authenticated savedCourseIds={savedCourseIds} /> : <Link className="text-link" href="/dashboard/explore">{copy.back} →</Link>}</div>
  </section>;
}
