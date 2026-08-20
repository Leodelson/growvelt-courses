import Link from "next/link";
import { getRequestLocale } from "@/app/lib/i18n-server";

export default async function AdminCourseNotFound() {
  const locale = await getRequestLocale();
  const text = locale === "fr" ? { eyebrow: "Cours indisponible", title: "Ce cours soumis n’est pas disponible ici.", copy: "Il a peut-être déjà été examiné ou son lien n’est plus valide.", action: "Retour aux examens des cours" } : locale === "es" ? { eyebrow: "Curso no disponible", title: "Este curso enviado no está disponible aquí.", copy: "Puede que ya se haya revisado o que el enlace ya no sea válido.", action: "Volver a revisiones de cursos" } : { eyebrow: "Course unavailable", title: "This submitted course isn’t available here.", copy: "It may have already been reviewed or the course link is no longer valid.", action: "Return to Course Reviews" };
  return <section className="route-feedback-page section-shell"><div className="route-feedback-panel"><p className="eyebrow">{text.eyebrow}</p><h1>{text.title}</h1><p>{text.copy}</p><Link className="button button-primary" href="/dashboard/admin/courses">{text.action}</Link></div></section>;
}
