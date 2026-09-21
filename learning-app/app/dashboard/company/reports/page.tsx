import Link from "next/link";
import { redirect } from "next/navigation";
import { LearningIcon } from "@/app/components/learning-icon";
import { getCompanyManagement, getOwnCompanyWorkspaces, type CompanyCourseAssignment } from "@/app/lib/company/workspaces";
import { createClient } from "@/app/lib/supabase/server";

export const metadata = { title: "Company learning report" };

type ReportAssignment = CompanyCourseAssignment & { workspace_name: string };
type ReportRow = { label: string; detail: string; assigned: number; completed: number; averageProgress: number };

function isCompleted(assignment: CompanyCourseAssignment) {
  return assignment.enrollment_status === "completed" || assignment.progress_percent >= 100;
}

function average(total: number, count: number) {
  return count ? Math.round(total / count) : 0;
}

export default async function CompanyLearningReportPage() {
  if (!(await (await createClient()).auth.getUser()).data.user) redirect("/sign-in");

  const workspaces = await getOwnCompanyWorkspaces();
  const manageable = workspaces.filter((workspace) => workspace.membership_status === "active" && (workspace.membership_role === "owner" || workspace.membership_role === "admin"));
  const management = await Promise.all(manageable.map(async (workspace) => ({ workspace, ...(await getCompanyManagement(workspace)) })));
  const assignments: ReportAssignment[] = management.flatMap(({ workspace, assignments: rows }) => rows.map((assignment) => ({ ...assignment, workspace_name: workspace.name })));

  const employeeMap = new Map<string, { label: string; detail: string; assigned: number; completed: number; progress: number }>();
  const courseMap = new Map<string, { label: string; detail: string; assigned: number; completed: number; progress: number }>();
  for (const assignment of assignments) {
    const employee = employeeMap.get(assignment.assigned_user_id) ?? { label: assignment.employee_name || assignment.employee_email, detail: assignment.employee_email, assigned: 0, completed: 0, progress: 0 };
    employee.assigned += 1;
    employee.completed += Number(isCompleted(assignment));
    employee.progress += assignment.progress_percent;
    employeeMap.set(assignment.assigned_user_id, employee);

    const courseKey = `${assignment.workspace_name}:${assignment.course_id}`;
    const course = courseMap.get(courseKey) ?? { label: assignment.course_title, detail: assignment.workspace_name, assigned: 0, completed: 0, progress: 0 };
    course.assigned += 1;
    course.completed += Number(isCompleted(assignment));
    course.progress += assignment.progress_percent;
    courseMap.set(courseKey, course);
  }

  const rows = (items: Iterable<{ label: string; detail: string; assigned: number; completed: number; progress: number }>): ReportRow[] => Array.from(items, (item) => ({ label: item.label, detail: item.detail, assigned: item.assigned, completed: item.completed, averageProgress: average(item.progress, item.assigned) })).sort((left, right) => right.averageProgress - left.averageProgress || left.label.localeCompare(right.label));
  const employees = rows(employeeMap.values());
  const courses = rows(courseMap.values());
  const completedAssignments = assignments.filter(isCompleted).length;
  const averageProgress = average(assignments.reduce((total, assignment) => total + assignment.progress_percent, 0), assignments.length);

  return <section className="instructor-earnings-page section-shell">
    <Link className="back-link" href="/dashboard/company"><LearningIcon name="arrow-left" size={17} />Back to Company learning</Link>
    <header className="instructor-earnings-hero"><p className="eyebrow">Private company report</p><h1>See learning progress across your company.</h1><p>This report covers only courses assigned through your company workspace. It never includes personal learning, personal courses, personal earnings, or Growvelt-wide financial data.</p></header>
    {!assignments.length ? <section className="organization-panel company-report-empty"><h2>No assigned learning yet</h2><p>Invite an employee and assign a published free course to begin private company reporting.</p><Link className="button button-primary" href="/dashboard/company">Manage company learning</Link></section> : <>
      <section className="organization-panel company-report-overview"><header><p className="eyebrow">Report overview</p><h2>Assigned learning</h2><p>Updated from the active assignments in your company workspaces.</p></header><div className="company-progress-summary"><div><strong>{assignments.length}</strong><span>Assigned courses</span></div><div><strong>{employees.length}</strong><span>Employees learning</span></div><div><strong>{completedAssignments}</strong><span>Completed</span></div><div><strong>{averageProgress}%</strong><span>Average progress</span></div></div></section>
      <section className="organization-panel company-report-panel"><header><p className="eyebrow">Employees</p><h2>Employee learning progress</h2><p>Each person’s totals include company-assigned courses only.</p></header><div className="company-report-table" role="table" aria-label="Employee learning progress"><div className="company-report-row company-report-heading" role="row"><span>Employee</span><span>Assigned</span><span>Completed</span><span>Progress</span></div>{employees.map((employee) => <div className="company-report-row" key={employee.detail} role="row"><span><strong>{employee.label}</strong><small>{employee.detail}</small></span><span>{employee.assigned}</span><span>{employee.completed}</span><span className="company-report-progress">{employee.averageProgress}%</span></div>)}</div></section>
      <section className="organization-panel company-report-panel"><header><p className="eyebrow">Courses</p><h2>Course assignment progress</h2><p>Courses are grouped within the company workspace that assigned them.</p></header><div className="company-report-table" role="table" aria-label="Course assignment progress"><div className="company-report-row company-report-heading" role="row"><span>Course</span><span>Assigned</span><span>Completed</span><span>Progress</span></div>{courses.map((course) => <div className="company-report-row" key={`${course.detail}-${course.label}`} role="row"><span><strong>{course.label}</strong><small>{course.detail}</small></span><span>{course.assigned}</span><span>{course.completed}</span><span className="company-report-progress">{course.averageProgress}%</span></div>)}</div></section>
    </>}
  </section>;
}
