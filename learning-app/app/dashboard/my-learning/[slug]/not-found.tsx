import Link from "next/link";
import { getRequestLocale } from "@/app/lib/i18n-server";

export default async function EnrolledCourseNotFound() {
  const locale = await getRequestLocale(); const text = locale === "fr" ? { eyebrow: "Cours indisponible", title: "Ce cours suivi n’est pas disponible ici.", copy: "Il n’est peut-être plus publié ou ce compte n’y a pas accès.", action: "Retour à Mon apprentissage" } : locale === "es" ? { eyebrow: "Curso no disponible", title: "Este curso inscrito no está disponible aquí.", copy: "Puede que ya no esté publicado o que esta cuenta no tenga acceso.", action: "Volver a Mi aprendizaje" } : { eyebrow: "Course unavailable", title: "This enrolled course isn’t available here.", copy: "It may no longer be published, or this account does not have access to it.", action: "Return to My Learning" };
  return <section className="route-feedback-page section-shell"><section className="route-feedback-panel"><p className="eyebrow">{text.eyebrow}</p><h1>{text.title}</h1><p>{text.copy}</p><Link className="button button-primary" href="/dashboard/my-learning">{text.action}</Link></section></section>;
}
