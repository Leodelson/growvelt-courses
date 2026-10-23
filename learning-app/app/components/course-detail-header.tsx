import Link from "next/link";
import { BookOpen, MonitorPlay, Layers3 } from "lucide-react";
import type { PublishedCourseDetail } from "@/app/lib/catalog/published-courses";
import { CourseVideoCover } from "./course-video-cover";
import { CourseRatingSummary } from "./learning/course-rating-summary";
import { VerifiedProviderBadge } from "./verified-provider-badge";
import styles from "./course-detail.module.css";
import { getRequestLocale } from "@/app/lib/i18n-server";
import { coursePresentationCopy } from "@/app/lib/catalog/course-presentation-copy";

export async function CourseDetailHeader({ course, dashboard = false }: { course: PublishedCourseDetail; dashboard?: boolean }) {
  const copy = coursePresentationCopy[await getRequestLocale()];
  const activityCount = course.modules.reduce((count, module) => count + module.lessons.filter((lesson) => lesson.type !== "project").length, 0);
  return <>
    <Link className={styles.back} href={dashboard ? "/dashboard/explore" : "/learn"}>← {copy.back}</Link>
    <header className={styles.hero}>
      <div className={styles.heroCopy}><p className="eyebrow">{course.category || "Growvelt"}</p><h1>{course.title}</h1><p className={styles.summary}>{course.summary || copy.fallback}</p>
        <p className={styles.byline}>{copy.learnWith} <strong>{course.instructorName || copy.instructor}</strong></p>
        {course.providerVerified && course.providerName && course.providerSlug ? <Link href={`/providers/${course.providerSlug}`}>{course.providerName} <VerifiedProviderBadge /></Link> : null}
        <CourseRatingSummary averageRating={course.averageRating} ratingCount={course.ratingCount} />
      </div>
      <div className={styles.cover}><span aria-hidden="true">{course.category || "Practical learning"}<small>GROWVELT</small></span><CourseVideoCover courseId={course.id} alt="" loading="eager" /></div>
    </header>
    <div className={styles.facts}><div><BookOpen size={22} aria-hidden="true"/><span><strong>{course.level || "All levels"}</strong>{copy.level}</span></div><div><Layers3 size={22} aria-hidden="true"/><span><strong>{course.modules.length} {copy.modules}</strong>{activityCount} {copy.activities}</span></div><div><MonitorPlay size={22} aria-hidden="true"/><span><strong>{copy.online}</strong>{copy.pace}</span></div></div>
    <nav className={styles.tabs} aria-label="Course sections"><a href="#course-about">{copy.about}</a><a href="#course-outline">{copy.outline}</a><a href="#course-access">{copy.enrollment}</a><a href="#course-recommendations">{copy.more}</a></nav>
  </>;
}
