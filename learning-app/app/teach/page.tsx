import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import FooterWrapper from "@/app/components/FooterWrapper";
import { PublicHeader } from "@/app/components/public-header";
import { getRequestLocale } from "@/app/lib/i18n-server";
import { translate } from "@/app/lib/i18n";

export const metadata: Metadata = { title: "Teach on Growvelt", description: "Apply to teach practical, career-relevant courses with Growvelt Learning.", alternates: { canonical: "/teach" }, openGraph: { url: "/teach", title: "Teach on Growvelt" } };
export default async function TeachPage() { const locale = await getRequestLocale(); const t = (key: Parameters<typeof translate>[1]) => translate(locale, key); return <div className="public-page"><PublicHeader /><main className="teach-page section-shell"><div><p className="eyebrow">{t("teach.eyebrow")}</p><h1>{t("teach.title")}</h1><p>{t("teach.copy")}</p><p className="rights-note"><strong>{t("teach.rightsTitle")}</strong> {t("teach.rightsCopy")}</p><Link className="button button-primary" href="/teach/apply">{t("teach.apply")}</Link></div><figure className="teach-hero-image"><Image src="/images/black-american-lady.png" alt={t("teach.imageAlt")} width={1200} height={800} priority /><figcaption><span>{t("teach.imageKicker")}</span><strong>{t("teach.imageTitle")}</strong></figcaption></figure><ol className="teach-journey"><li><span>01</span><div><strong>{t("teach.share")}</strong><p>{t("teach.shareCopy")}</p></div></li><li><span>02</span><div><strong>{t("teach.quality")}</strong><p>{t("teach.qualityCopy")}</p></div></li><li><span>03</span><div><strong>{t("teach.publish")}</strong><p>{t("teach.publishCopy")}</p></div></li></ol><p className="demo-note">{t("teach.note")}</p></main><FooterWrapper /></div>; }
