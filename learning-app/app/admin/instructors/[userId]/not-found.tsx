import Link from "next/link";

export default function InstructorApplicationNotFound() {
  return <main className="route-feedback-page section-shell"><section className="route-feedback-panel"><p className="eyebrow">Application unavailable</p><h1>That Instructor application is not available.</h1><p>It may have been removed from the review queue or the link may be incomplete.</p><Link className="button button-primary" href="/admin/instructors">Back to Instructor applications</Link></section></main>;
}
