"use client";

import { RouteError } from "@/app/components/ui/route-error";
import { useLanguage } from "@/app/components/language-provider";

export default function MyLearningError({ reset }: { reset: () => void }) {
  const { locale } = useLanguage();
  const text = locale === "fr" ? { title: "Impossible de charger Mon apprentissage", copy: "Réessayez ou parcourez le catalogue de cours publiés.", action: "Explorer le catalogue" } : locale === "es" ? { title: "No se pudo cargar Mi aprendizaje", copy: "Inténtalo de nuevo o explora el catálogo de cursos publicados.", action: "Explorar catálogo" } : { title: "Unable to load My Learning", copy: "Try again, or browse the published course catalog.", action: "Explore catalog" };
  return <RouteError title={text.title} description={text.copy} reset={reset} recoveryHref="/dashboard/explore" recoveryLabel={text.action} />;
}
