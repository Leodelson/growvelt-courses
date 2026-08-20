"use client";

import Link from "next/link";
import { ActionButton } from "@/app/components/ui/action-button";
import { useLanguage } from "@/app/components/language-provider";

export function RouteError({ title, description, reset, recoveryHref, recoveryLabel }: { title: string; description: string; reset: () => void; recoveryHref: string; recoveryLabel: string }) {
  const { locale } = useLanguage();
  const text = locale === "fr" ? { eyebrow: "Une nouvelle tentative est nécessaire", retry: "Réessayer" } : locale === "es" ? { eyebrow: "Hace falta otro intento", retry: "Intentar de nuevo" } : { eyebrow: "Something needs another try", retry: "Try again" };
  return <main className="route-feedback-page section-shell"><section className="route-feedback-panel" role="alert"><p className="eyebrow">{text.eyebrow}</p><h1>{title}</h1><p>{description}</p><div className="route-feedback-actions"><ActionButton className="button button-primary" type="button" onClick={reset}>{text.retry}</ActionButton><Link className="button button-secondary" href={recoveryHref}>{recoveryLabel}</Link></div></section></main>;
}
