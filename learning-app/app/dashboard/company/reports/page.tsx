import Link from "next/link";
import { redirect } from "next/navigation";
import { getCompanyManagement, getOwnCompanyWorkspaces } from "@/app/lib/company/workspaces";
import { createClient } from "@/app/lib/supabase/server";
import { assignmentState, displayProgress, type CompanyReportRow } from "@/app/lib/company/presentation";
import { CompanyReportList } from "@/app/components/company/report-list";
import base from "@/app/components/instructor/provider-workspaces.module.css";
import styles from "@/app/components/company/workspaces.module.css";

export const metadata = { title: "Company learning report" };

export default async function CompanyLearningReportPage() {
  if (!(await (await createClient()).auth.getUser()).data.user) redirect("/sign-in");
  const workspaces = await getOwnCompanyWorkspaces();
  const manageable = workspaces.filter((workspace) => workspace.membership_status === "active" && (workspace.membership_role === "owner" || workspace.membership_role === "admin"));
  const management = await Promise.all(manageable.map(async (workspace) => ({ workspace, ...(await getCompanyManagement(workspace)) })));
  const assignments: CompanyReportRow[] = management.flatMap(({ workspace, assignments: rows }) => rows.map((assignment) => ({ ...assignment, workspace_name: workspace.name })));
  const employeeCount = new Set(assignments.map((assignment) => assignment.assigned_user_id)).size;
  const completedCount = assignments.filter(row => assignmentState(row) === "completed").length;
  const averageProgress = assignments.length ? Math.round(assignments.reduce((total, row) => total + displayProgress(row.progress_percent), 0) / assignments.length) : 0;

  return <section className={`instructor-earnings-page section-shell ${base.page} ${styles.page}`}>
    <Link className={base.back} href="/dashboard/company">← Back to Company learning</Link>
    <header className="instructor-earnings-hero"><p className="eyebrow">Private company report</p><h1>Your team’s assigned learning.</h1><p>Follow employee progress across company-sponsored courses. Personal learning, personal earnings and Growvelt-wide financial data are never included.</p></header>
    <dl className={styles.summary} aria-label="All authorized assignment records">{[{label:"Assignments",value:assignments.length},{label:"Employees with assignments",value:employeeCount},{label:"Completed assignments",value:completedCount},{label:"Average recorded progress",value:`${averageProgress}%`}].map(item=><div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
    {!assignments.length ? <section className="organization-panel company-report-empty"><h2>No assigned learning yet</h2><p>Invite an employee and assign a published free course to begin private company reporting. Paid assignments follow the existing payment-confirmation requirements.</p></section> : <section className="organization-panel company-report-panel">
      <header><p className="eyebrow">Employee and course progress</p><h2>Find an assignment</h2><p>Search by employee, email, course or company. The overview above covers all loaded assignment records; cancelled assignments remain available in history but are not counted as completed assignments.</p></header>
      <CompanyReportList assignments={assignments.map(({assignment_id,employee_name,employee_email,course_title,workspace_name,assignment_status,enrollment_status,progress_percent,assigned_at})=>({assignment_id,employee_name,employee_email,course_title,workspace_name,assignment_status,enrollment_status,progress_percent,assigned_at}))}/>
    </section>}
  </section>;
}
