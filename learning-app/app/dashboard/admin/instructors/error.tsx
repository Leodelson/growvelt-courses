"use client";

import { RouteError } from "@/app/components/ui/route-error";
import { useLanguage } from "@/app/components/language-provider";

export default function AdminInstructorError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { locale } = useLanguage();
  const text = locale === "fr" ? { title: "Nous n’avons pas pu charger les candidatures instructeur.", copy: "Réessayez ou retournez aux opérations administrateur.", action: "Opérations administrateur" } : locale === "es" ? { title: "No pudimos cargar las solicitudes de instructor.", copy: "Inténtalo de nuevo o vuelve a Operaciones de administración.", action: "Operaciones de administración" } : { title: "We couldn’t load Instructor applications.", copy: "Try again, or return to Admin Operations.", action: "Admin Operations" };
  return <RouteError title={text.title} description={text.copy} reset={reset} recoveryHref="/dashboard/admin" recoveryLabel={text.action} />;
}
