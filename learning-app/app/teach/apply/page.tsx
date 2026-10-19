import { redirect } from "next/navigation";
import { InstructorApplicationForm } from "@/app/components/instructor/application-form";
import { PublicHeader } from "@/app/components/public-header";
import { getOwnInstructorApplicationContext } from "@/app/lib/instructor/application";
import { getRequestLocale } from "@/app/lib/i18n-server";
import { translate } from "@/app/lib/i18n";
import styles from "@/app/components/public/coverage-refinements.module.css";

export const metadata = { title: "Apply to teach" };

export default async function TeachApplyPage() {
  const [{ application, identity }, locale] = await Promise.all([getOwnInstructorApplicationContext(), getRequestLocale()]);
  if (application) redirect("/teach/application");
  const preparation = {
    en: { title: "Before you apply", items: ["Describe the subjects you teach and your practical experience.", "Prepare examples of teaching, mentoring or training you have delivered.", "Add a portfolio link if you have one. It is optional."] },
    fr: { title: "Avant de postuler", items: ["Décrivez vos sujets d’enseignement et votre expérience pratique.", "Préparez des exemples de cours, de mentorat ou de formations que vous avez animés.", "Ajoutez un lien vers votre portfolio si vous en avez un. Il est facultatif."] },
    es: { title: "Antes de solicitar", items: ["Describe las materias que enseñas y tu experiencia práctica.", "Prepara ejemplos de enseñanza, mentoría o formación que hayas impartido.", "Añade un enlace a tu portafolio si tienes uno. Es opcional."] },
  }[locale];
  return <div className="public-page"><PublicHeader /><main id="public-main" className={`instructor-page section-shell ${styles.application}`}><div className="instructor-page-intro"><p className="eyebrow">{translate(locale, "teach.eyebrow")}</p><h1>{translate(locale, "teach.applyTitle")}</h1><p>{translate(locale, "teach.applyCopy")}</p><aside className={styles.preparation}><h2>{preparation.title}</h2><ul>{preparation.items.map((item) => <li key={item}>{item}</li>)}</ul></aside></div><InstructorApplicationForm identity={identity} /></main></div>;
}
