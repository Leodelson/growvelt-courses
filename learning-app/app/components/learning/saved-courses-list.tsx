"use client";

import Link from "next/link";
import { useState } from "react";
import { PublishedCourseCard } from "@/app/components/published-course-card";
import { useLanguage } from "@/app/components/language-provider";
import type { PublishedCourse } from "@/app/lib/catalog/published-courses";

export function SavedCoursesList({ courses: initialCourses }: { courses: PublishedCourse[] }) {
  const { locale } = useLanguage();
  const text = locale === "fr" ? { eyebrow: "Rien d’enregistré", title: "Enregistrez les cours qui vous intéressent.", copy: "Sélectionnez le cœur sur un cours pour le conserver dans cette liste privée.", explore: "Explorer le catalogue", end: "Fin des cours enregistrés" } : locale === "es" ? { eyebrow: "Aún no hay cursos guardados", title: "Guarda los cursos que te interesen.", copy: "Selecciona el corazón en cualquier curso para conservarlo en esta lista privada.", explore: "Explorar catálogo", end: "Fin de los cursos guardados" } : { eyebrow: "Nothing saved yet", title: "Save courses that catch your interest.", copy: "Select the heart on any course to keep it in this private list.", explore: "Explore catalog", end: "End of saved courses" };
  const [courses, setCourses] = useState(initialCourses);

  if (!courses.length) {
    return <section className="course-empty-state saved-courses-empty"><p className="eyebrow">{text.eyebrow}</p><h2>{text.title}</h2><p>{text.copy}</p><Link className="button button-primary" href="/dashboard/explore">{text.explore}</Link></section>;
  }

  return <><div className="course-grid published-course-grid public-published-course-grid">{courses.map((course, index) => <PublishedCourseCard course={course} index={index} authenticated isSaved href={`/dashboard/courses/${encodeURIComponent(course.slug)}`} key={course.id} onSavedChange={(isSaved) => { if (!isSaved) setCourses((currentCourses) => currentCourses.filter((currentCourse) => currentCourse.id !== course.id)); }} />)}</div><p className="results-end-marker saved-courses-end-marker">{text.end}</p></>;
}
