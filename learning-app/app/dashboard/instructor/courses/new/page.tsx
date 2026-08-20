import { CourseDraftForm } from "@/app/components/instructor/course-draft-form";
import { getRequestLocale } from "@/app/lib/i18n-server";

export const metadata = { title: "Create course draft" };

export default async function DashboardNewInstructorCoursePage() {
  const locale = await getRequestLocale();
  const text = locale === "fr" ? { eyebrow: "Brouillon privé", title: "Commencez un cours avec un résultat clair.", copy: "Cela crée un brouillon privé appartenant à l’instructeur. Il ne soumet pas, ne publie pas et ne propose pas le cours aux apprenants." } : locale === "es" ? { eyebrow: "Borrador privado", title: "Comienza un curso con un resultado claro.", copy: "Esto crea un borrador privado del instructor. No envía, publica ni ofrece el curso a los estudiantes." } : { eyebrow: "Private draft", title: "Start a course with a clear outcome.", copy: "This creates a private Instructor-owned draft. It does not submit, publish, or offer the course to learners." };
  return <section className="course-editor-page section-shell"><header className="course-editor-heading"><p className="eyebrow">{text.eyebrow}</p><h1>{text.title}</h1><p>{text.copy}</p></header><CourseDraftForm mode="create" /></section>;
}
