import { Skeleton } from "@/app/components/ui/skeleton";
import { getRequestLocale } from "@/app/lib/i18n-server";

const loadingLabels = { en: "Loading certificate verification", fr: "Chargement de la vérification du certificat", es: "Cargando la verificación del certificado" } as const;

export default async function VerificationLoading() {
  const locale = await getRequestLocale();

  return (
    <main className="certificate-view section-shell" aria-label={loadingLabels[locale]}>
      <Skeleton className="skeleton-block" style={{ minHeight: 260 }} aria-hidden="true" />
    </main>
  );
}
