import Link from "next/link";
import { notFound } from "next/navigation";
import { EnrollmentButton } from "@/app/components/learning/enrollment-button";
import { getPublishedLearningCourse } from "@/app/lib/catalog/published-courses";
import { getEnrollmentState } from "@/app/lib/learning/enrollments";

export const metadata = { title: "Course" };

function formatDuration(seconds: number | null) {
  return seconds ? `${Math.max(1, Math.round(seconds / 60))} min` : null;
}

export default async function PublishedCourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slug || slug.length > 220) notFound();
  const course = await getPublishedLearningCourse(slug);
  if (!course) notFound();
  const enrollment = await getEnrollmentState(course.id);
  const pricing = course.isFree ? "Free" : `${course.priceCurrency || "NGN"} ${Number(course.priceAmount ?? 0).toLocaleString("en-NG")}`;

  return <section className="published-course-page section-shell"><header className="published-course-hero"><Link className="back-link" href="/dashboard/explore">Explore catalog</Link><p className="eyebrow">{course.category || "Growvelt Learning"}</p><h1>{course.title}</h1><p className="published-course-summary">{course.summary || "A practical Growvelt Learning course."}</p><div className="published-course-meta"><span>{course.level || "All levels"}</span><span>{pricing}</span><span>{course.instructorName ? `By ${course.instructorName}` : "Growvelt Instructor"}</span></div></header><div className="published-course-layout"><article className="published-course-content"><section><h2>About this course</h2><p className="published-course-description">{course.description || "Course details will be expanded as Growvelt Learning grows."}</p></section><section><div className="published-outline-heading"><div><p className="eyebrow">Course outline</p><h2>What you’ll explore</h2></div><p>Lesson playback is coming next.</p></div>{course.modules.length === 0 ? <p className="published-outline-empty">The course outline is being prepared.</p> : <ol className="published-outline">{course.modules.map((module, moduleIndex) => <li key={module.id}><h3>{String(moduleIndex + 1).padStart(2, "0")} · {module.title}</h3><ol>{module.lessons.map((lesson, lessonIndex) => <li key={lesson.id}><span>{lessonIndex + 1}. {lesson.title}</span><small>{lesson.type === "video" ? "Video" : "Text lesson"}{lesson.isPreview ? " · Preview" : ""}{lesson.isPreview && lesson.preview ? ` · ${formatDuration(lesson.preview.durationSeconds) || "Preview"}` : ""}</small></li>)}</ol></li>)}</ol>}</section></article><aside className="published-course-aside"><p className="eyebrow">Course access</p><h2>{enrollment.isEnrolled ? "You’re enrolled" : course.isFree ? "Start learning for free" : "Paid access is coming later"}</h2><p>{enrollment.isEnrolled ? "This course is in My Learning. The lesson player is the next learning experience to arrive." : course.isFree ? "Enroll to add this course to My Learning. Lesson playback will arrive in the next checkpoint." : "Growvelt has not enabled paid enrollment or checkout yet."}</p><EnrollmentButton courseId={course.id} slug={course.slug} isFree={course.isFree} isEnrolled={enrollment.isEnrolled} /><Link className="text-link" href="/dashboard/explore">Browse more courses</Link></aside></div></section>;
}
