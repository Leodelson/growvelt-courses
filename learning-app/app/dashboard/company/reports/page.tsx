import Link from "next/link";
import { redirect } from "next/navigation";
import { LearningIcon } from "@/app/components/learning-icon";
import { getCompanyManagement, getOwnCompanyWorkspaces, type CompanyCourseAssignment } from "@/app/lib/company/workspaces";
import { createClient } from "@/app/lib/supabase/server";

export const metadata = { title: "Company learning report" };

type ReportAssignment = CompanyCourseAssignment & { workspace_name: string };

function isCompleted(assignment: CompanyCourseAssignment) {
  return assignment.enrollment_status === "completed" || assignment.progress_percent >= 100;
}

export default async function CompanyLearningReportPage() {
  if (!(await (await createClient()).auth.getUser()).data.user) redirect("/sign-in");

  const workspaces = await getOwnCompanyWorkspaces();
  const manageable = workspaces.filter((workspace) => workspace.membership_status === "active" && (workspace.membership_role === "owner" || workspace.membership_role === "admin"));
  const management = await Promise.all(manageable.map(async (workspace) => ({ workspace, ...(await getCompanyManagement(workspace)) })));
  const assignments: ReportAssignment[] = management.flatMap(({ workspace, assignments: rows }) => rows.map((assignment) => ({ ...assignment, workspace_name: workspace.name })));
  const employeeCount = new Set(assignments.map((assignment) => assignment.assigned_user_id)).size;
  const completedCount = assignments.filter(isCompleted).length;
  const averageProgress = assignments.length ? Math.round(assignments.reduce((total, assignment) => total + assignment.progress_percent, 0) / assignments.length) : 0;

  return <section className="instructor-earnings-page section-shell">
    <Link className="back-link" href="/dashboard/company"><LearningIcon name="arrow-left" size={17} />Back to Company learning</Link>
    <header className="instructor-earnings-hero"><p className="eyebrow">Private company report</p><h1>See every assigned course in one place.</h1><p>Each row connects an employee to the course and company workspace that assigned it. This report never includes personal learning, personal courses, personal earnings, or Growvelt-wide financial data.</p></header>
    {!assignments.length ? <section className="organization-panel company-report-empty"><h2>No assigned learning yet</h2><p>Invite an employee and assign a published free course to begin private company reporting.</p><Link className="button button-primary" href="/dashboard/company">Manage company learning</Link></section> : <section className="organization-panel company-report-panel">
      <header><p className="eyebrow">Assigned learning</p><h2>Employee and course progress</h2><p>One row represents one company assignment, so different courses remain easy to distinguish.</p></header>
      <div className="company-progress-summary"><div><strong>{assignments.length}</strong><span>Assignments</span></div><div><strong>{employeeCount}</strong><span>Employees</span></div><div><strong>{completedCount}</strong><span>Completed</span></div><div><strong>{averageProgress}%</strong><span>Average progress</span></div></div>
      <div className="company-report-table" role="table" aria-label="Company assigned learning progress">
        <div className="company-report-row company-report-heading" role="row"><span>Employee</span><span>Course</span><span>Company</span><span>Assigned</span><span>Completed</span><span>Progress</span></div>
        {assignments.map((assignment) => <div className="company-report-row" key={assignment.assignment_id} role="row"><span><strong>{assignment.employee_name || assignment.employee_email}</strong><small>{assignment.employee_email}</small></span><span data-label="Course"><strong>{assignment.course_title}</strong></span><span data-label="Company"><small>{assignment.workspace_name}</small></span><span data-label="Assigned"><small>{new Date(assignment.assigned_at).toLocaleDateString("en-NG")}</small></span><span data-label="Completed"><small>{isCompleted(assignment) ? "Yes" : "No"}</small></span><span data-label="Progress" className="company-report-progress"><strong>{assignment.progress_percent}%</strong><Link href={`/dashboard/company/insights?assignment=${assignment.assignment_id}`}>View details</Link></span></div>)}
      </div>
    </section>}
  </section>;
}
