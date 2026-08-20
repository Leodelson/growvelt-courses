import Link from "next/link";
import { SavedCoursesList } from "@/app/components/learning/saved-courses-list";
import { getRequestLocale } from "@/app/lib/i18n-server";
import { listOwnSavedLearningCourses } from "@/app/lib/learning/saved-courses";

export const metadata = { title: "Saved courses" };

export default async function SavedCoursesPage() {
  const [courses, locale] = await Promise.all([listOwnSavedLearningCourses(), getRequestLocale()]);
  const text = locale === "fr" ? { eyebrow: "Cours enregistrés", title: "Votre sélection privée de cours.", copy: "Les cours que vous enregistrez apparaissent ici, prêts lorsque vous souhaitez les revoir ou vous y inscrire.", explore: "Explorer le catalogue" } : locale === "es" ? { eyebrow: "Cursos guardados", title: "Tu lista privada de cursos.", copy: "Los cursos que guardas aparecen aquí, listos cuando quieras volver a verlos o inscribirte.", explore: "Explorar catálogo" } : { eyebrow: "Saved courses", title: "Your private course shortlist.", copy: "Courses you save appear here, ready whenever you want to revisit or enroll.", explore: "Explore catalog" };

  return <section className="saved-courses-page section-shell">
    <header className="saved-courses-hero">
      <div><p className="eyebrow">{text.eyebrow}</p><h1>{text.title}</h1><p>{text.copy}</p></div>
      <Link className="button button-primary" href="/dashboard/explore">{text.explore}</Link>
    </header>
    <SavedCoursesList courses={courses} />
  </section>;
}
