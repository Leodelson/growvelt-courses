import Link from "next/link";
import { getRequestLocale } from "@/app/lib/i18n-server";

export default async function DashboardAdminInstructorNotFound() {
  const locale = await getRequestLocale();
  const text = locale === "fr" ? { eyebrow: "Candidature indisponible", title: "Cette candidature instructeur n’est pas disponible.", copy: "Retournez à la file protégée pour poursuivre votre examen.", action: "Retour aux candidatures" } : locale === "es" ? { eyebrow: "Solicitud no disponible", title: "Esta solicitud de instructor no está disponible.", copy: "Vuelve a la cola protegida para continuar la revisión.", action: "Volver a las solicitudes" } : { eyebrow: "Application unavailable", title: "That Instructor application is not available.", copy: "Return to the protected application queue to continue your review.", action: "Back to Instructor applications" };
  return <section className="route-feedback-page section-shell"><section className="route-feedback-panel"><p className="eyebrow">{text.eyebrow}</p><h1>{text.title}</h1><p>{text.copy}</p><Link className="button button-primary" href="/dashboard/admin/instructors">{text.action}</Link></section></section>;
}
