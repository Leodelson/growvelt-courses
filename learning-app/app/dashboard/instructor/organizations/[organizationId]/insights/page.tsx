import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isApprovedInstructor } from "@/app/lib/instructor/authorization";
import { getOwnProviderOrganizationInsights } from "@/app/lib/instructor/provider-insights";
import { getOwnInstructorOrganizations } from "@/app/lib/instructor/organizations";

export const metadata = { title: "Organization insights" };

const money = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

function statusLabel(status: "draft" | "pending_review" | "published" | "archived") {
  return status === "pending_review" ? "Pending review" : status.charAt(0).toUpperCase() + status.slice(1);
}

export default async function ProviderInsightsPage({ params }: { params: Promise<{ organizationId: string }> }) {
  if (!await isApprovedInstructor()) redirect("/teach/application");
  const organizationId = Number((await params).organizationId);
  if (!Number.isSafeInteger(organizationId) || organizationId < 1) notFound();
  const organizations = await getOwnInstructorOrganizations();
  const organization = organizations.find((item) => item.organization_id === organizationId && item.membership_status === "active" && item.organization_status === "active");
  if (!organization) notFound();
  const insights = await getOwnProviderOrganizationInsights(organizationId);

  return <section className="provider-insights-page section-shell">
    <header className="provider-insights-hero">
      <div><p className="eyebrow">Organization insights</p><h1>{organization.name} at a glance.</h1><p>Aggregate learning, certificate, and sales performance for courses attributed to this organization. Instructor earnings, payouts, and Growvelt internal economics remain private.</p></div>
      <Link className="button button-secondary" href={organization.membership_role === "owner" ? `/dashboard/instructor/organizations/${organizationId}/profile` : "/dashboard/instructor/organizations"}>{organization.membership_role === "owner" ? "Back to provider profile" : "Back to organizations"}</Link>
    </header>
    <section className="provider-insights-summary" aria-label="Provider report summary">
      <article><span>Organization courses</span><strong>{insights.courses.length}</strong><small>{insights.totalEnrolledLearners} enrolled learners</small></article>
      <article><span>Completion rate</span><strong>{insights.overallCompletionRate}%</strong><small>{insights.totalCompletedLearners} completed enrollments</small></article>
      <article><span>Issued certificates</span><strong>{insights.totalIssuedCertificates}</strong><small>Provider-attributed achievement records</small></article>
      <article><span>Gross sales</span><strong>{money.format(insights.totalGrossSalesMinor / 100)}</strong><small>Paid allocations, excluding reversed allocations</small></article>
    </section>
    {insights.courses.length ? <section className="provider-insights-courses"><header><div><p className="eyebrow">Course reporting</p><h2>Learning, certificates, and sales by course</h2></div><p>All learner activity is reported as aggregate counts for active organization members.</p></header><div>{insights.courses.map((course) => <article key={course.courseId}><div className="provider-insights-course-heading"><div><span className={`course-status-badge is-${course.status}`}>{statusLabel(course.status)}</span><h3>{course.title}</h3></div><strong>{money.format(course.grossSalesMinor / 100)}</strong></div><dl><div><dt>Enrolled</dt><dd>{course.enrolledLearnerCount}</dd></div><div><dt>Active</dt><dd>{course.activeLearnerCount}</dd></div><div><dt>Completed</dt><dd>{course.completedLearnerCount}</dd></div><div><dt>Completion</dt><dd>{course.completionRate}%</dd></div><div><dt>Certificates issued</dt><dd>{course.issuedCertificateCount}</dd></div><div><dt>Paid orders</dt><dd>{course.paidOrderCount}</dd></div></dl><div className="instructor-analytics-progress" aria-label={`${course.completionRate}% course completion`}><span style={{ width: `${course.completionRate}%` }} /></div>{course.reversedOrderCount > 0 && <p className="provider-insights-note">{course.reversedOrderCount} reversed organization sale{course.reversedOrderCount === 1 ? "" : "s"} excluded from gross sales.</p>}</article>)}</div></section> : <section className="provider-insights-empty"><p className="eyebrow">No organization reporting yet</p><h2>Create an organization course to begin.</h2><p>Once attributed courses are published and learners enroll, their aggregate learning, certificate, and sales reporting will appear here.</p><Link className="button button-primary" href="/dashboard/instructor/courses/new">Create organization course</Link></section>}
  </section>;
}
