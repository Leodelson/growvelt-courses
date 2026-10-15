"use client";

import type { CourseRating } from "@/app/lib/catalog/course-ratings";
import { useLanguage } from "@/app/components/language-provider";
import { coursePresentationCopy } from "@/app/lib/catalog/course-presentation-copy";
import styles from "./course-rating.module.css";

export function CourseRatingSummary({ averageRating, ratingCount }: CourseRating) {
  const { locale } = useLanguage();
  const copy = coursePresentationCopy[locale];
  return <span className={styles.summary}>{ratingCount && averageRating ? <><span aria-hidden="true" className={styles.gold}>★</span><strong>{averageRating.toFixed(1)}</strong><span>({ratingCount.toLocaleString()} {ratingCount === 1 ? copy.rating : copy.ratings})</span><span className={styles.sr}>{averageRating} {copy.outOf}</span></> : <span>{ratingCount === undefined ? copy.unavailable : copy.noRatings}</span>}</span>;
}
