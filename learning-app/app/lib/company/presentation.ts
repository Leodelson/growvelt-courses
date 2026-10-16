import type { CompanyCourseAssignment, CompanyPaidCoursePurchase } from "./workspaces";

export function companyDate(value: string | null | undefined) {
  return value && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value))
    : "Date unavailable";
}

export function displayProgress(value: number) {
  return Number.isFinite(value) ? Math.round(Math.max(0, Math.min(100, value))) : 0;
}

export function assignmentState(row: Pick<CompanyCourseAssignment, "assignment_status" | "enrollment_status" | "progress_percent">) {
  if (row.assignment_status === "cancelled") return "cancelled";
  const progress = Number.isFinite(row.progress_percent) ? row.progress_percent : 0;
  if (row.enrollment_status === "completed" || progress >= 100) return "completed";
  return row.enrollment_status === "active" || progress > 0 ? "in_progress" : "not_started";
}

export const assignmentLabels = { not_started: "Not started", in_progress: "In progress", completed: "Completed", cancelled: "Assignment cancelled" };
export const purchaseLabels = { checkout_ready: "Checkout ready", checkout_pending: "Awaiting confirmation", paid: "Paid", cancelled: "Cancelled", expired: "Expired" };
export function billingSnapshot(purchases: CompanyPaidCoursePurchase[]) {
  const paid = purchases.filter(row => row.status === "paid");
  return { purchases: purchases.length, paid: paid.length, seats: paid.reduce((sum, row) => sum + row.seat_count, 0), paidMinor: paid.reduce((sum, row) => sum + row.total_amount_minor, 0) };
}
export type CompanyReportRow = CompanyCourseAssignment & { workspace_name: string };
export type CompanyReportItem = Pick<CompanyReportRow, "assignment_id" | "employee_name" | "employee_email" | "course_title" | "workspace_name" | "assignment_status" | "enrollment_status" | "progress_percent" | "assigned_at">;
