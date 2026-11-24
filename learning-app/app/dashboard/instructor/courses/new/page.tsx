import { CourseDraftForm } from "@/app/components/instructor/course-draft-form";
import { getRequestLocale } from "@/app/lib/i18n-server";
import { getOwnInstructorOrganizations } from "@/app/lib/instructor/organizations";

import { CourseWorkflow } from "@/app/components/instructor/authoring-tools";
import styles from "@/app/components/instructor/workbench.module.css";

export const metadata = { title: "Create course draft" };

export default async function DashboardNewInstructorCoursePage() {
  const locale = await getRequestLocale();
  const organizations = await getOwnInstructorOrganizations();
  const text = locale === "fr"
    ? { eyebrow: "Brouillon privé", title: "Créer un cours", copy: "Renseignez les détails de votre cours. Vous pourrez ajouter des leçons après l’enregistrement du brouillon." }
    : locale === "es"
      ? { eyebrow: "Borrador privado", title: "Crear un curso", copy: "Completa los datos del curso. Podrás añadir lecciones después de guardar el borrador." }
      : { eyebrow: "Private draft", title: "Create a course", copy: "Set up your course details. You can add lessons after you save your draft." };
  return <section className={`course-editor-page section-shell ${styles.page}`}><CourseWorkflow active="details" /><header className="course-editor-heading"><div><p className="eyebrow">{text.eyebrow}</p><h1>{text.title}</h1><p>{text.copy}</p></div></header><CourseDraftForm mode="create" organizations={organizations} /></section>;
}
