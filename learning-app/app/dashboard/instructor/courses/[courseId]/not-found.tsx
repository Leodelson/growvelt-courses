import Link from "next/link";

export default function DashboardInstructorCourseNotFound() {
  return <section className="route-feedback-page section-shell"><section className="route-feedback-panel"><p className="eyebrow">Course unavailable</p><h1>That course is not available in your workspace.</h1><p>It may not exist, or it may belong to another Instructor.</p><Link className="button button-primary" href="/dashboard/instructor/courses">Back to your courses</Link></section></section>;
}
