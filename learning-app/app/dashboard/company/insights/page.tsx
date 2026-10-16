import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCompanyManagement, getOwnCompanyWorkspaces } from "@/app/lib/company/workspaces";
import { createClient } from "@/app/lib/supabase/server";
import { assignmentLabels, assignmentState, companyDate, displayProgress } from "@/app/lib/company/presentation";
import base from "@/app/components/instructor/provider-workspaces.module.css";
import styles from "@/app/components/company/workspaces.module.css";

export const metadata = { title: "Company learning progress" };

export default async function CompanyLearningInsightsPage({ searchParams }: { searchParams: Promise<{ assignment?: string }> }) {
  if (!(await (await createClient()).auth.getUser()).data.user) redirect("/sign-in");
  const assignmentId = Number((await searchParams).assignment);
  if (!Number.isSafeInteger(assignmentId) || assignmentId < 1) notFound();
  const workspaces = await getOwnCompanyWorkspaces();
  const management = await Promise.all(workspaces.filter((workspace) => workspace.membership_status === "active" && (workspace.membership_role === "owner" || workspace.membership_role === "admin")).map(async (workspace) => ({ workspace, ...(await getCompanyManagement(workspace)) })));
  const result = management.map((item) => ({ ...item, assignment: item.assignments.find((assignment) => assignment.assignment_id === assignmentId) })).find((item) => item.assignment);
  if (!result?.assignment) notFound();
  const { assignment, workspace } = result;
  const progress = displayProgress(assignment.progress_percent), state = assignmentState(assignment);
  return <section className={`instructor-earnings-page section-shell ${base.page} ${styles.page}`}>
    <Link className={base.back} href="/dashboard/company/reports">← Back to employee reports</Link>
    <header className="instructor-earnings-hero"><p className="eyebrow">Company learning insights</p><h1>{assignment.employee_name || assignment.employee_email}</h1><p>{assignment.employee_email} · {workspace.name}</p></header>
    <section className="organization-panel company-progress-detail-page">
      <header><p className="eyebrow">Assigned course</p><h2>{assignment.course_title}</h2><p>Only authorized company owners and admins can view this assignment. Personal learning and individual answers are not included.</p></header>
      <div className="company-progress-summary"><div><strong>{progress}%</strong><span>Recorded course progress</span></div><div><strong>{assignmentLabels[state]}</strong><span>Assignment state</span></div><div><strong>{companyDate(assignment.assigned_at)}</strong><span>Assigned on</span></div></div>
      <div className={styles.progress} role="progressbar" aria-label="Recorded course progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${progress}%`}} /></div>
      <p className={styles.notice}>{state==="cancelled" ? "This assignment was cancelled. The recorded progress is retained for company reporting; it does not confirm current course access." : state==="completed" ? "The assigned course is recorded as completed. This report does not confirm certificate issuance." : state==="not_started" ? "No progress has been recorded for this assignment yet." : `${progress}% of the assigned course is recorded as complete.`}</p>
    </section>
    <section className="organization-panel"><header><p className="eyebrow">Assignment context</p><h2>Company-sponsored learning record</h2><p>This record belongs to the company assignment, not the employee’s complete learning history.</p></header><dl className={styles.facts}><div><dt>Company workspace</dt><dd>{workspace.name}</dd></div><div><dt>Assignment reference</dt><dd>#{assignment.assignment_id}</dd></div><div><dt>Assignment status</dt><dd>{assignment.assignment_status}</dd></div><div><dt>Enrollment status</dt><dd>{assignment.enrollment_status==="completed"?"Completed":assignment.enrollment_status==="active"?"Active":"Not started"}</dd></div></dl></section>
  </section>;
}
