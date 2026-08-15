"use client";

import Link from "next/link";
import { useState } from "react";
import { PublishedCourseCard } from "@/app/components/published-course-card";
import type { PublishedCourse } from "@/app/lib/catalog/published-courses";

export function SavedCoursesList({ courses: initialCourses }: { courses: PublishedCourse[] }) {
  const [courses, setCourses] = useState(initialCourses);

  if (!courses.length) {
    return <section className="course-empty-state saved-courses-empty"><p className="eyebrow">Nothing saved yet</p><h2>Save courses that catch your interest.</h2><p>Select the heart on any course to keep it in this private list.</p><Link className="button button-primary" href="/dashboard/explore">Explore catalog</Link></section>;
  }

  return <><div className="course-grid published-course-grid public-published-course-grid">{courses.map((course, index) => <PublishedCourseCard course={course} index={index} authenticated isSaved href={`/dashboard/courses/${encodeURIComponent(course.slug)}`} key={course.id} onSavedChange={(isSaved) => { if (!isSaved) setCourses((currentCourses) => currentCourses.filter((currentCourse) => currentCourse.id !== course.id)); }} />)}</div><p className="results-end-marker saved-courses-end-marker">End of saved courses</p></>;
}
