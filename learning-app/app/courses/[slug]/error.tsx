"use client";

import Link from "next/link";
import FooterWrapper from "@/app/components/FooterWrapper";
import { PublicHeader } from "@/app/components/public-header";
import { ActionButton } from "@/app/components/ui/action-button";

export default function PublicCourseError({ reset }: { reset: () => void }) {
  return <div className="public-page">
    <PublicHeader />
    <main className="route-feedback-page section-shell">
      <section className="route-feedback-panel" role="alert">
        <p className="eyebrow">Something needs another try</p>
        <h1>We couldn’t load this course.</h1>
        <p>Please try again. You can also return to the current Growvelt Learning catalog.</p>
        <div className="route-feedback-actions">
          <ActionButton className="button button-primary" type="button" onClick={reset}>Try again</ActionButton>
          <Link className="button button-secondary" href="/learn">Explore courses</Link>
        </div>
      </section>
    </main>
    <FooterWrapper />
  </div>;
}
