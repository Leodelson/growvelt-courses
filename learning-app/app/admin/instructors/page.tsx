import Link from "next/link";
import { redirect } from "next/navigation";
import { ProtectedPageHeader } from "@/app/components/protected-page-header";
import { isLearningAdmin } from "@/app/lib/admin/authorization";
import { getPendingInstructorApplications } from "@/app/lib/admin/instructor-applications";

export const metadata = { title: "Instructor applications" };

export default async function AdminInstructorQueuePage() {
  if (!await isLearningAdmin()) redirect("/dashboard");
  const applications = await getPendingInstructorApplications();

  return <><ProtectedPageHeader context="Learning operations" backHref="/dashboard" backLabel="Learning dashboard" /><main id="main-content" className="admin-page section-shell"><header className="admin-page-header"><p className="eyebrow">Learning operations</p><h1>Instructor applications</h1><p>Review pending applications. Approval grants teaching capability only through the protected database review action.</p></header>{applications.length ? <div className="admin-application-list">{applications.map((application) => <article className="admin-application-row" key={application.user_id}><div><p className="admin-status">Pending review</p><h2>{application.headline || "Instructor application"}</h2><p>{application.expertise?.filter(Boolean).join(" · ") || "No expertise supplied"}</p></div><div className="admin-row-meta"><time dateTime={application.created_at}>Submitted {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(application.created_at))}</time><Link className="button button-secondary" href={`/admin/instructors/${application.user_id}`}>Review application</Link></div></article>)}</div> : <section className="admin-empty-state"><p className="eyebrow">All caught up</p><h2>No pending Instructor applications.</h2><p>New applications will appear here when submitted.</p></section>}</main></>;
}
