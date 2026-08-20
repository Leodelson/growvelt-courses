"use client";

import Link from "next/link";
import FooterWrapper from "@/app/components/FooterWrapper";
import { PublicHeader } from "@/app/components/public-header";
import { ActionButton } from "@/app/components/ui/action-button";
import { useLanguage } from "@/app/components/language-provider";

export default function PublicCourseError({ reset }: { reset: () => void }) {
  const { t } = useLanguage();
  return <div className="public-page">
    <PublicHeader />
    <main className="route-feedback-page section-shell">
      <section className="route-feedback-panel" role="alert">
        <p className="eyebrow">{t("catalog.errorEyebrow")}</p>
        <h1>{t("catalog.errorTitle")}</h1>
        <p>{t("catalog.errorCopy")}</p>
        <div className="route-feedback-actions">
          <ActionButton className="button button-primary" type="button" onClick={reset}>{t("catalog.tryAgain")}</ActionButton>
          <Link className="button button-secondary" href="/learn">{t("catalog.back")}</Link>
        </div>
      </section>
    </main>
    <FooterWrapper />
  </div>;
}
