import Link from "next/link";
import type { ReactNode } from "react";
import type { PublishedCourse } from "@/app/lib/catalog/published-courses";

const visualStyles = ["data", "sql", "ai", "product"] as const;

function highlight(text: string, query: string): ReactNode {
  const term = query.trim();
  if (!term) return text;
  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.split(new RegExp(`(${escapedTerm})`, "ig")).map((piece, pieceIndex) => piece.toLowerCase() === term.toLowerCase() ? <mark key={pieceIndex}>{piece}</mark> : piece);
}

export function PublishedCourseCard({ course, index, href, highlightQuery = "" }: { course: PublishedCourse; index: number; href?: string; highlightQuery?: string }) {
  const visual = visualStyles[index % visualStyles.length];
  const pricing = course.isFree ? "Free" : `${course.priceCurrency || "NGN"} ${Number(course.priceAmount ?? 0).toLocaleString("en-NG")}`;

  return <article className="course-card published-course-card">
    <div className={`course-visual course-visual-${visual}`} aria-hidden="true"><span className="course-visual-index">GROWVELT</span><span className="course-visual-word">{course.category || "Learning"}</span><span className="course-visual-grid" /><span className="course-visual-shape course-visual-shape-one" /><span className="course-visual-shape course-visual-shape-two" /></div>
    <div className="course-card-body">
      <div className="course-meta"><span>{course.category || "Learning"}</span><span>{course.level || "All levels"}</span></div>
      <h2>{highlight(course.title, highlightQuery)}</h2><p>{highlight(course.summary || "A practical Growvelt Learning course.", highlightQuery)}</p>
      <div className="course-details"><span>{course.instructorName ? `By ${course.instructorName}` : "Growvelt Instructor"}</span><span>{pricing}</span></div>
      <div className="course-card-footer"><strong>{course.isFree ? "Open to learn" : pricing}</strong><Link href={href ?? `/dashboard/courses/${encodeURIComponent(course.slug)}`}>View course</Link></div>
    </div>
  </article>;
}
