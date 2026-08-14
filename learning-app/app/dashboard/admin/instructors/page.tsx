import Link from "next/link";
import { getPendingInstructorApplications } from "@/app/lib/admin/instructor-applications";

export const metadata = { title: "Instructor reviews" };

export default async function DashboardAdminInstructorQueuePage() {
  const applications = await getPendingInstructorApplications();

  return <section className="admin-page admin-instructor-review-queue section-shell">
    <header className="admin-page-header admin-review-hero"><p className="eyebrow">Admin Reviews</p><h1>Instructor reviews</h1><p>Review teaching applications and grant Instructor capability only through the protected database decision.</p><div className="admin-review-summary"><span><strong>{applications.length}</strong> awaiting review</span><span>Oldest applications remain visible until decided</span></div></header>
    {applications.length ? <>
      <div className="admin-application-list admin-course-review-list">{applications.map((application) => <article className="admin-application-row admin-course-review-row" key={application.user_id}><div><p className="admin-status">Pending review</p><h2>{application.full_name || application.headline || "Instructor application"}</h2><p className="admin-course-instructor">{application.headline || "Professional headline not supplied"}</p><div className="admin-course-meta"><span>{application.country || "Country not supplied"}</span>{application.expertise?.filter(Boolean).slice(0, 4).map((expertise) => <span key={expertise}>{expertise}</span>)}</div></div><div className="admin-row-meta"><time dateTime={application.created_at}>Submitted {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(application.created_at))}</time><Link className="button button-secondary" href={`/dashboard/admin/instructors/${application.user_id}`}>Review application <span aria-hidden="true">→</span><span className="sr-only"> from {application.full_name || application.headline || "this applicant"}</span></Link></div></article>)}</div>
      <div className="results-end-marker admin-review-end-marker">End of Instructor Reviews</div>
    </> : <section className="admin-empty-state admin-course-review-empty"><p className="eyebrow">All caught up</p><h2>No pending Instructor applications.</h2><p>New applications will appear here when submitted.</p></section>}
  </section>;
}
