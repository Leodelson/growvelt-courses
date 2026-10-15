"use client";

import { useState, useTransition } from "react";
import { saveCourseRating } from "@/app/lib/learning/rating-actions";
import styles from "./course-rating.module.css";
import { useLanguage } from "@/app/components/language-provider";
import { coursePresentationCopy } from "@/app/lib/catalog/course-presentation-copy";

export function CourseRatingForm({ courseId, initialRating }: { courseId: number; initialRating: number | null }) {
  const { locale } = useLanguage();
  const copy = coursePresentationCopy[locale];
  const [rating, setRating] = useState(initialRating ?? 0);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  return <section className={styles.form} aria-labelledby="course-rating-heading">
    <p className="eyebrow">{copy.feedback}</p><h2 id="course-rating-heading">{copy.question}</h2>
    <p>{copy.feedbackCopy}</p>
    <form onSubmit={(event) => { event.preventDefault(); startTransition(async () => { setMessage(""); try { const result = await saveCourseRating(courseId, rating); setMessage(result.error ? copy.error : copy.thanks); } catch { setMessage(copy.error); } }); }}>
      <fieldset disabled={pending}><legend>{copy.choose}</legend><div className={styles.stars}>{[1, 2, 3, 4, 5].map((value) => <label key={value}><input type="radio" name="rating" value={value} checked={rating === value} onChange={() => setRating(value)} required /><span aria-hidden="true" data-filled={value <= rating}>★</span><span className={styles.sr}>{value} {value === 1 ? copy.star : copy.stars}</span></label>)}</div></fieldset>
      <button className="button button-primary" disabled={!rating || pending} type="submit">{pending ? <><span className="catalog-loader" aria-hidden="true" /> {copy.saving}</> : initialRating ? copy.update : copy.save}</button>
      <p role="status" aria-live="polite">{message}</p>
    </form>
  </section>;
}
