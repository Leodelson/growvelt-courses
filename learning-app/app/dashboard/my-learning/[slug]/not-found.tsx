import Link from "next/link";

export default function EnrolledCourseNotFound() {
  return <section className="route-feedback-page section-shell"><section className="route-feedback-panel"><p className="eyebrow">Course unavailable</p><h1>This enrolled course isn’t available here.</h1><p>It may no longer be published, or this account does not have access to it.</p><Link className="button button-primary" href="/dashboard/my-learning">Return to My Learning</Link></section></section>;
}
