import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LearningIcon } from "@/app/components/learning-icon";
import { getCompanyManagement, getOwnCompanyWorkspaces } from "@/app/lib/company/workspaces";
import { createClient } from "@/app/lib/supabase/server";

export const metadata = { title: "Company learning progress" };

export default async function CompanyLearningInsightsPage({ searchParams }: { searchParams: Promise<{ assignment?: string }> }) {
  if (!(await (await createClient()).auth.getUser()).data.user) redirect("/sign-in");
  const assignmentId = Number((await searchParams).assignment);
  if (!Number.isSafeInteger(assignmentId)) notFound();
  const workspaces = await getOwnCompanyWorkspaces();
  const management = await Promise.all(workspaces.filter((workspace) => workspace.membership_status === "active" && (workspace.membership_role === "owner" || workspace.membership_role === "admin")).map(async (workspace) => ({ workspace, ...(await getCompanyManagement(workspace)) })));
  const result = management.map((item) => ({ ...item, assignment: item.assignments.find((assignment) => assignment.assignment_id === assignmentId) })).find((item) => item.assignment);
  if (!result?.assignment) notFound();
  const { assignment, workspace } = result;
  return <section className="instructor-earnings-page section-shell"><Link className="back-link" href="/dashboard/company"><LearningIcon name="arrow-left" size={17} />Back to Company learning</Link><header className="instructor-earnings-hero"><p className="eyebrow">Company learning insights</p><h1>{assignment.employee_name || assignment.employee_email}</h1><p>{assignment.employee_email} · {workspace.name}</p></header><section className="organization-panel company-progress-detail-page"><header><p className="eyebrow">Assigned course</p><h2>{assignment.course_title}</h2><p>Only company owners and admins can view this assignment progress. Personal learning, personal earnings, and Growvelt financial data are excluded.</p></header><div className="company-progress-summary"><div><strong>{assignment.progress_percent}%</strong><span>Course progress</span></div><div><strong>{assignment.enrollment_status || "Not started"}</strong><span>Enrollment status</span></div><div><strong>{new Date(assignment.assigned_at).toLocaleDateString("en-NG")}</strong><span>Assigned on</span></div></div><div className="company-progress-focus"><span className="company-progress-bar" aria-label={`${assignment.progress_percent}% complete`}><span style={{ width: `${assignment.progress_percent}%` }} /></span><p>{assignment.progress_percent === 100 ? "This employee has completed the assigned course." : `${assignment.progress_percent}% of the assigned course is complete.`}</p></div></section></section>;
}
