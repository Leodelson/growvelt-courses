import Link from "next/link";

export default function DashboardAdminInstructorNotFound() {
  return <section className="route-feedback-page section-shell"><section className="route-feedback-panel"><p className="eyebrow">Application unavailable</p><h1>That Instructor application is not available.</h1><p>Return to the protected application queue to continue your review.</p><Link className="button button-primary" href="/dashboard/admin/instructors">Back to Instructor applications</Link></section></section>;
}
