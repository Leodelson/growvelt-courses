"use client";

import { RouteError } from "@/app/components/ui/route-error";
import { useLanguage } from "@/app/components/language-provider";

export default function PublicCatalogError({ reset }: { reset: () => void }) {
  const { t } = useLanguage();
  return <RouteError title={t("catalog.catalogErrorTitle")} description={t("catalog.catalogErrorCopy")} reset={reset} recoveryHref="/" recoveryLabel={t("catalog.learningHome")} />;
}
