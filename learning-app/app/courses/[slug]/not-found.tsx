import Link from "next/link";
import FooterWrapper from "@/app/components/FooterWrapper";
import { PublicHeader } from "@/app/components/public-header";

export default function PublicCourseNotFound() {
  return <div className="public-page">
    <PublicHeader />
    <main className="route-feedback-page section-shell">
      <section className="route-feedback-panel">
        <p className="eyebrow">Course unavailable</p>
        <h1>This course is not available.</h1>
        <p>It may have moved, been unpublished, or the course link may be incomplete. Browse the current catalog to find another practical learning path.</p>
        <div className="route-feedback-actions">
          <Link className="button button-primary" href="/learn">Explore courses</Link>
          <Link className="button button-secondary" href="/">Learning home</Link>
        </div>
      </section>
    </main>
    <FooterWrapper />
  </div>;
}
