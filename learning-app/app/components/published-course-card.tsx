import Link from "next/link";
import type { ReactNode } from "react";
import { SaveCourseButton } from "@/app/components/learning/save-course-button";
import { CourseVideoCover } from "@/app/components/course-video-cover";
import type { PublishedCourse } from "@/app/lib/catalog/published-courses";
import { useLanguage } from "@/app/components/language-provider";
import { VerifiedProviderBadge } from "@/app/components/verified-provider-badge";
import { CourseRatingSummary } from "./learning/course-rating-summary";
import styles from "./published-course-card.module.css";
import { coursePresentationCopy } from "@/app/lib/catalog/course-presentation-copy";

const visualStyles = ["data", "sql", "ai", "product"] as const;

function highlight(text: string, query: string): ReactNode {
  const term = query.trim();
  if (!term) return text;
  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.split(new RegExp(`(${escapedTerm})`, "ig")).map((piece, pieceIndex) => piece.toLowerCase() === term.toLowerCase() ? <mark key={pieceIndex}>{piece}</mark> : piece);
}

export function PublishedCourseCard({ course, index, href, highlightQuery = "", authenticated = false, isSaved = false, onSavedChange }: { course: PublishedCourse; index: number; href?: string; highlightQuery?: string; authenticated?: boolean; isSaved?: boolean; onSavedChange?: (isSaved: boolean) => void }) {
  const { t, locale } = useLanguage();
  const copy = coursePresentationCopy[locale];
  const visual = visualStyles[index % visualStyles.length];
  const pricing = course.isFree ? t("catalog.free") : `${course.priceCurrency || "NGN"} ${Number(course.priceAmount ?? 0).toLocaleString("en-NG")}`;

  const destination = href ?? `/courses/${encodeURIComponent(course.slug)}`;
  return <article className={styles.card}>
    <Link className={`${styles.visual} course-visual-${visual}`} href={destination} tabIndex={-1} aria-hidden="true"><span className={styles.fallback}>{course.category || t("catalog.fallbackCategory")}</span><CourseVideoCover courseId={course.id} alt="" /><span className={styles.tag}>{course.isFree ? copy.free : copy.course}</span></Link>
    <div className={styles.body}>
      <div className={styles.meta}><span>{course.category || t("catalog.fallbackCategory")}</span><SaveCourseButton courseId={course.id} isSaved={isSaved} authenticated={authenticated} signInHref={`/sign-up?next=${encodeURIComponent(`/courses/${course.slug}`)}`} onSavedChange={onSavedChange} /></div>
      <p className={styles.instructor}>{course.instructorName ? `${t("catalog.byInstructor")} ${course.instructorName}` : t("catalog.defaultInstructor")}</p>
      <h2><Link href={destination}>{highlight(course.title, highlightQuery)}</Link></h2><p className={styles.description}>{highlight(course.summary || t("catalog.fallbackSummary"), highlightQuery)}</p>
      <CourseRatingSummary averageRating={course.averageRating} ratingCount={course.ratingCount} />
      <span className={styles.level}>{course.level || t("catalog.allLevels")}</span>
      {course.providerVerified && course.providerName && course.providerSlug && <Link className="course-provider-link" href={`/providers/${course.providerSlug}`}>{course.providerName} <VerifiedProviderBadge /></Link>}
      <div className={styles.footer}><strong>{pricing}</strong><Link href={destination}>{t("catalog.viewCourse")} <span aria-hidden="true">↗</span></Link></div>
    </div>
  </article>;
}
