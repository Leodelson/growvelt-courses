import Link from "next/link";
import FooterWrapper from "@/app/components/FooterWrapper";
import { PublicHeader } from "@/app/components/public-header";
import { getRequestLocale } from "@/app/lib/i18n-server";
import { translate } from "@/app/lib/i18n";

export default async function PublicCourseNotFound() {
  const locale = await getRequestLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  return <div className="public-page">
    <PublicHeader />
    <main className="route-feedback-page section-shell">
      <section className="route-feedback-panel">
        <p className="eyebrow">{t("catalog.unavailable")}</p>
        <h1>{t("catalog.unavailableTitle")}</h1>
        <p>{t("catalog.unavailableCopy")}</p>
        <div className="route-feedback-actions">
          <Link className="button button-primary" href="/learn">{t("catalog.back")}</Link>
          <Link className="button button-secondary" href="/">{t("catalog.learningHome")}</Link>
        </div>
      </section>
    </main>
    <FooterWrapper />
  </div>;
}
