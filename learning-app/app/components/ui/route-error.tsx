"use client";

import Link from "next/link";
import { ActionButton } from "@/app/components/ui/action-button";

export function RouteError({ title, description, reset, recoveryHref, recoveryLabel }: { title: string; description: string; reset: () => void; recoveryHref: string; recoveryLabel: string }) {
  return <main className="route-feedback-page section-shell"><section className="route-feedback-panel" role="alert"><p className="eyebrow">Something needs another try</p><h1>{title}</h1><p>{description}</p><div className="route-feedback-actions"><ActionButton className="button button-primary" type="button" onClick={reset}>Try again</ActionButton><Link className="button button-secondary" href={recoveryHref}>{recoveryLabel}</Link></div></section></main>;
}
