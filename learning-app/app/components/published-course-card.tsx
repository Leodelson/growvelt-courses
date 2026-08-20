import Link from "next/link";
import type { ReactNode } from "react";
import { SaveCourseButton } from "@/app/components/learning/save-course-button";
import { CourseVideoCover } from "@/app/components/course-video-cover";
import type { PublishedCourse } from "@/app/lib/catalog/published-courses";
import { useLanguage } from "@/app/components/language-provider";

const visualStyles = ["data", "sql", "ai", "product"] as const;

function highlight(text: string, query: string): ReactNode {
  const term = query.trim();
  if (!term) return text;
  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.split(new RegExp(`(${escapedTerm})`, "ig")).map((piece, pieceIndex) => piece.toLowerCase() === term.toLowerCase() ? <mark key={pieceIndex}>{piece}</mark> : piece);
}

export function PublishedCourseCard({ course, index, href, highlightQuery = "", authenticated = false, isSaved = false, onSavedChange }: { course: PublishedCourse; index: number; href?: string; highlightQuery?: string; authenticated?: boolean; isSaved?: boolean; onSavedChange?: (isSaved: boolean) => void }) {
  const { t } = useLanguage();
  const visual = visualStyles[index % visualStyles.length];
  const pricing = course.isFree ? "Free" : `${course.priceCurrency || "NGN"} ${Number(course.priceAmount ?? 0).toLocaleString("en-NG")}`;

  return <article className="course-card published-course-card">
    <div className={`course-visual course-visual-${visual}`}><CourseVideoCover courseId={course.id} alt="" /><span className="course-visual-index">GROWVELT</span><span className="course-visual-word">{course.category || t("catalog.fallbackCategory")}</span><span className="course-visual-grid" /><span className="course-visual-shape course-visual-shape-one" /><span className="course-visual-shape course-visual-shape-two" /></div>
    <div className="course-card-body">
      <div className="course-meta"><span>{course.category || t("catalog.fallbackCategory")}</span><span>{course.level || t("catalog.allLevels")}</span><SaveCourseButton courseId={course.id} isSaved={isSaved} authenticated={authenticated} signInHref={`/sign-up?next=${encodeURIComponent(`/courses/${course.slug}`)}`} onSavedChange={onSavedChange} /></div>
      <h2>{highlight(course.title, highlightQuery)}</h2><p>{highlight(course.summary || t("catalog.fallbackSummary"), highlightQuery)}</p>
      <div className="course-details"><span>{course.instructorName ? `${t("catalog.byInstructor")} ${course.instructorName}` : t("catalog.defaultInstructor")}</span><span>{pricing}</span></div>
      <div className="course-card-footer"><strong>{course.isFree ? t("catalog.openToLearn") : pricing}</strong><Link href={href ?? `/courses/${encodeURIComponent(course.slug)}`}>{t("catalog.viewCourse")}</Link></div>
    </div>
  </article>;
}
