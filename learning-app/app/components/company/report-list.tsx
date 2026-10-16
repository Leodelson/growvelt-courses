"use client";

import Link from "next/link";
import { WorkbenchList } from "@/app/components/instructor/workbench-list";
import { assignmentLabels, assignmentState, companyDate, displayProgress, type CompanyReportItem } from "@/app/lib/company/presentation";
import styles from "./workspaces.module.css";

export function CompanyReportList({ assignments }: { assignments: CompanyReportItem[] }) {
  return <WorkbenchList metricLabel="Progress, highest first" statuses={assignmentLabels} items={assignments.map(row => ({
    id: String(row.assignment_id), title: row.employee_name || row.employee_email,
    keywords: `${row.employee_email} ${row.course_title} ${row.workspace_name}`,
    status: assignmentState(row), metric: displayProgress(row.progress_percent),
    content: <article className={styles.reportCard}>
      <header><div><p className={styles.kicker}>{row.workspace_name}</p><h3>{row.employee_name || row.employee_email}</h3><p>{row.employee_email}</p></div><span className={styles.badge}>{assignmentLabels[assignmentState(row)]}</span></header>
      <h4>{row.course_title}</h4>
      <dl><div><dt>Assigned on</dt><dd>{companyDate(row.assigned_at)}</dd></div><div><dt>Recorded progress</dt><dd>{displayProgress(row.progress_percent)}%</dd></div></dl>
      <div className={styles.progress} role="progressbar" aria-label={`Recorded progress for ${row.course_title}`} aria-valuenow={displayProgress(row.progress_percent)} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${displayProgress(row.progress_percent)}%`}} /></div>
      <footer><span>Company assignment #{row.assignment_id}</span><Link href={`/dashboard/company/insights?assignment=${row.assignment_id}`}>View assignment details <span aria-hidden="true">→</span></Link></footer>
    </article>,
  }))} />;
}
