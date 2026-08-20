"use client";

import { RouteError } from "@/app/components/ui/route-error";
import { useLanguage } from "@/app/components/language-provider";

export default function EnrolledCourseError({ reset }: { reset: () => void }) {
  const { locale } = useLanguage();
  const text = locale === "fr" ? { title: "Impossible de charger ce cours suivi", copy: "Réessayez ou retournez à vos cours suivis.", action: "Mon apprentissage" } : locale === "es" ? { title: "No se pudo cargar este curso inscrito", copy: "Inténtalo de nuevo o vuelve a tus cursos inscritos.", action: "Mi aprendizaje" } : { title: "Unable to load this enrolled course", copy: "Try again, or return to your enrolled courses.", action: "My Learning" };
  return <RouteError title={text.title} description={text.copy} reset={reset} recoveryHref="/dashboard/my-learning" recoveryLabel={text.action} />;
}
