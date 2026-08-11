import Link from "next/link";

export default function AdminCourseNotFound() {
  return <section className="route-feedback-page section-shell"><div className="route-feedback-panel"><p className="eyebrow">Course unavailable</p><h1>This submitted course isn’t available here.</h1><p>It may have already been reviewed or the course link is no longer valid.</p><Link className="button button-primary" href="/dashboard/admin/courses">Return to Course Reviews</Link></div></section>;
}
