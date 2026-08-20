"use client";

import { RouteError } from "@/app/components/ui/route-error";
import { useLanguage } from "@/app/components/language-provider";

export default function AdminCoursesError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { locale } = useLanguage();
  const text = locale === "fr" ? { title: "Nous n’avons pas pu charger les examens des cours", copy: "Réessayez. Si le problème persiste, retournez aux opérations administrateur.", action: "Opérations administrateur" } : locale === "es" ? { title: "No pudimos cargar las revisiones de cursos", copy: "Inténtalo de nuevo. Si el problema continúa, vuelve a Operaciones de administración.", action: "Operaciones de administración" } : { title: "We couldn’t load course reviews", copy: "Try again. If the issue continues, return to Admin Operations.", action: "Admin Operations" };
  return <RouteError title={text.title} description={text.copy} recoveryHref="/dashboard/admin" recoveryLabel={text.action} reset={reset} />;
}
