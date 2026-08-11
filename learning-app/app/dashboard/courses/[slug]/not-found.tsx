import Link from "next/link";

export default function PublishedCourseNotFound() {
  return <section className="route-feedback-page section-shell"><section className="route-feedback-panel"><p className="eyebrow">Course unavailable</p><h1>This published course could not be found.</h1><p>It may have moved or is no longer available.</p><Link className="button button-primary" href="/dashboard/explore">Explore catalog</Link></section></section>;
}
