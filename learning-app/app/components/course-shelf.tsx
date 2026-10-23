"use client";

import { useEffect, useRef, useState } from "react";
import type { PublishedCourse } from "@/app/lib/catalog/published-courses";
import { PublishedCourseCard } from "./published-course-card";
import styles from "./course-shelf.module.css";
import { useLanguage } from "./language-provider";
import { coursePresentationCopy } from "@/app/lib/catalog/course-presentation-copy";

export function CourseShelf({ title, description, courses, dashboard = false, authenticated = false, savedCourseIds = [] }: { title: string; description?: string; courses: PublishedCourse[]; dashboard?: boolean; authenticated?: boolean; savedCourseIds?: number[] }) {
  const { locale } = useLanguage();
  const copy = coursePresentationCopy[locale];
  const track = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ start: true, end: courses.length < 2 });
  function measure() { const el = track.current; if (el) setPosition({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 }); }
  useEffect(() => { const el = track.current; if (!el) return; const observer = new ResizeObserver(measure); observer.observe(el); return () => observer.disconnect(); }, [courses.length]);
  function move(direction: number) { const el = track.current; if (el) el.scrollBy({ left: direction * el.clientWidth * .85, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); }
  return <section className={styles.shelf} aria-label={title}>
    <header className={styles.heading}><div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div><div className={styles.arrows}><button type="button" aria-label={`${copy.previous}: ${title}`} disabled={position.start} onClick={() => move(-1)}>←</button><button type="button" aria-label={`${copy.next}: ${title}`} disabled={position.end} onClick={() => move(1)}>→</button></div></header>
    <div className={styles.track} ref={track} onScroll={measure} tabIndex={0} aria-label={`${title}, ${copy.scroll}`}>{courses.map((course, index) => <PublishedCourseCard key={course.id} course={course} index={index} href={`${dashboard ? "/dashboard/courses" : "/courses"}/${encodeURIComponent(course.slug)}`} authenticated={authenticated} isSaved={savedCourseIds.includes(course.id)} />)}</div>
  </section>;
}
