import { notFound, redirect } from "next/navigation";
import { InstructorReviewForm } from "@/app/components/admin/instructor-review-form";
import { ProtectedPageHeader } from "@/app/components/protected-page-header";
import { isLearningAdmin } from "@/app/lib/admin/authorization";
import { getInstructorApplicationForAdmin } from "@/app/lib/admin/instructor-applications";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const metadata = { title: "Review Instructor application" };

export default async function AdminInstructorDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  if (!await isLearningAdmin()) redirect("/dashboard");
  const { userId } = await params;
  if (!uuidPattern.test(userId)) notFound();
  const application = await getInstructorApplicationForAdmin(userId);
  if (!application) notFound();

  const submitted = new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date(application.created_at));
  return <><ProtectedPageHeader context="Application review" backHref="/admin/instructors" backLabel="Instructor applications" /><main id="main-content" className="admin-page section-shell"><header className="admin-page-header"><p className="eyebrow">Application review</p><h1>{application.headline || "Instructor application"}</h1><p>Submitted {submitted}</p></header><div className="admin-detail-grid"><article className="admin-application-detail"><div><p className="eyebrow">Areas of expertise</p><p>{application.expertise?.filter(Boolean).join(" · ") || "No expertise supplied"}</p></div><div><p className="eyebrow">Experience and teaching goals</p><p className="admin-bio">{application.bio || "No description supplied"}</p></div><div><p className="eyebrow">Current status</p><p className={`admin-status admin-status-${application.approval_status}`}>{application.approval_status}</p></div></article>{application.approval_status === "pending" ? <InstructorReviewForm userId={application.user_id} /> : <section className="admin-review-panel"><p className="eyebrow">Decision recorded</p><h2>This application is {application.approval_status}.</h2><p>{application.review_note || "No internal review note was recorded."}</p></section>}</div></main></>;
}
