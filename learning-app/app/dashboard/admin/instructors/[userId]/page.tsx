import { notFound } from "next/navigation";
import { InstructorReviewForm } from "@/app/components/admin/instructor-review-form";
import { getInstructorApplicationForAdmin } from "@/app/lib/admin/instructor-applications";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const metadata = { title: "Review Instructor application" };

export default async function DashboardAdminInstructorDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  if (!uuidPattern.test(userId)) notFound();
  const application = await getInstructorApplicationForAdmin(userId);
  if (!application) notFound();

  const submitted = new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date(application.created_at));
  return <section className="admin-page section-shell"><header className="admin-page-header"><p className="eyebrow">Admin Operations</p><h1>{application.full_name || application.headline || "Instructor application"}</h1><p>Submitted {submitted}</p></header><div className="admin-detail-grid"><article className="admin-application-detail"><div><p className="eyebrow">Applicant</p><p className="admin-identity"><strong>{application.full_name || "Name not supplied"}</strong><span>{application.email || "Email unavailable"}</span></p></div><div><p className="eyebrow">Location and contact</p><p>{application.country || "Country not supplied"}</p>{application.phone && <p>{application.phone}</p>}</div><div><p className="eyebrow">Professional headline</p><p>{application.headline || "No headline supplied"}</p></div><div><p className="eyebrow">Areas of expertise</p><p>{application.expertise?.filter(Boolean).join(" · ") || "No expertise supplied"}</p></div><div><p className="eyebrow">Professional experience</p><p>{application.years_experience === null ? "Years not supplied" : `${application.years_experience} year${application.years_experience === 1 ? "" : "s"} of experience`}</p></div><div><p className="eyebrow">Teaching experience</p><p className="admin-bio">{application.teaching_experience || "No teaching experience supplied"}</p></div><div><p className="eyebrow">Professional background</p><p className="admin-bio">{application.bio || "No background supplied"}</p></div><div><p className="eyebrow">Motivation to teach</p><p className="admin-bio">{application.motivation || "No motivation supplied"}</p></div>{application.portfolio_url && <div><p className="eyebrow">Professional link</p><a className="admin-external-link" href={application.portfolio_url} target="_blank" rel="noreferrer">Open professional link<span className="sr-only"> in a new tab</span></a></div>}<div><p className="eyebrow">Current status</p><p className={`admin-status admin-status-${application.approval_status}`}>{application.approval_status}</p></div></article>{application.approval_status === "pending" ? <InstructorReviewForm userId={application.user_id} /> : <section className="admin-review-panel"><p className="eyebrow">Decision recorded</p><h2>This application is {application.approval_status}.</h2><p>{application.review_note || "No internal review note was recorded."}</p></section>}</div></section>;
}
