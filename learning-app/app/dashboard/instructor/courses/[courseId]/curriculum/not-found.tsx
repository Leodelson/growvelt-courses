import Link from "next/link";

export default function CurriculumNotFound() {
  return <section className="route-feedback-page section-shell"><div className="route-feedback-panel"><p className="eyebrow">Curriculum unavailable</p><h1>This course isn’t available here.</h1><p>It may not belong to this Instructor account, or the course link is no longer valid.</p><Link className="button button-primary" href="/dashboard/instructor/courses">Return to My Courses</Link></div></section>;
}
