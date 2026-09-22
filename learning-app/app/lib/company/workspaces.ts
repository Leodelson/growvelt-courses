import { createClient } from "@/app/lib/supabase/server";

export type CompanyWorkspace = {
  workspace_id: number;
  name: string;
  slug: string;
  workspace_status: "active" | "suspended" | "archived";
  membership_role: "owner" | "admin" | "member";
  membership_status: "active" | "suspended" | "removed";
  seat_limit: number;
  active_member_count: number;
  pending_invitation_count: number;
  created_at: string;
};
export type CompanyMember = { member_id: string; full_name: string | null; email: string; role: "owner" | "admin" | "member"; status: "active" | "suspended" | "removed"; granted_at: string };
export type CompanyManagerInvitation = { invitation_id: number; invited_email: string; role: "admin" | "member"; status: "pending" | "accepted" | "declined" | "cancelled" | "expired"; created_at: string; expires_at: string };
export type CompanyInvitation = { invitation_id: number; workspace_id: number; workspace_name: string; role: "admin" | "member"; status: "pending"; invited_by_name: string | null; expires_at: string; created_at: string };
export type CompanyAssignableCourse = { course_id: number; title: string; summary: string | null; category: string | null; level: string | null };
export type CompanyPaidCourse = { course_id: number; title: string; summary: string | null; category: string | null; level: string | null; price_amount: number; currency: "NGN"; instructor_name: string | null; provider_name: string };
export type CompanyPaidCoursePurchase = { purchase_id: number; course_title: string; provider_name: string; seat_count: number; unit_amount_minor: number; total_amount_minor: number; currency: "NGN"; status: "checkout_ready" | "checkout_pending" | "paid" | "cancelled" | "expired"; created_at: string };
export type CompanyCourseAssignment = { assignment_id: number; assigned_user_id: string; employee_name: string | null; employee_email: string; course_id: number; course_slug: string; course_title: string; assignment_status: "active" | "cancelled"; assigned_at: string; enrollment_status: "active" | "completed" | null; progress_percent: number };
export type CompanyAssignedCourse = { assignment_id: number; workspace_id: number; workspace_name: string; course_id: number; course_slug: string; course_title: string; assigned_at: string; enrollment_status: "active" | "completed" | null };

export async function getOwnCompanyWorkspaces() {
  const { data, error } = await (await createClient()).rpc("list_own_learning_company_workspaces");
  if (error) throw new Error("Unable to load company workspaces.");
  return (data ?? []) as CompanyWorkspace[];
}

export async function getOwnCompanyInvitations() {
  const { data, error } = await (await createClient()).rpc("list_own_learning_company_invitations");
  if (error) throw new Error("Unable to load company invitations.");
  return (data ?? []) as CompanyInvitation[];
}

export async function getCompanyManagement(workspace: CompanyWorkspace) {
  const supabase = await createClient();
  const canManage = workspace.membership_role === "owner" || workspace.membership_role === "admin";
  const [members, invitations, courses, assignments, paidCourses, paidPurchases] = await Promise.all([
    supabase.rpc("list_own_learning_company_members", { p_workspace_id: workspace.workspace_id }),
    canManage
      ? supabase.rpc("list_own_learning_company_invitations_as_manager", { p_workspace_id: workspace.workspace_id })
      : Promise.resolve({ data: [], error: null }),
    canManage ? supabase.rpc("list_own_learning_company_assignable_courses", { p_workspace_id: workspace.workspace_id }) : Promise.resolve({ data: [], error: null }),
    canManage ? supabase.rpc("list_own_learning_company_course_assignments", { p_workspace_id: workspace.workspace_id }) : Promise.resolve({ data: [], error: null }),
    canManage ? supabase.rpc("list_own_learning_company_paid_courses", { p_workspace_id: workspace.workspace_id }) : Promise.resolve({ data: [], error: null }),
    canManage ? supabase.rpc("list_own_learning_company_paid_course_purchases", { p_workspace_id: workspace.workspace_id }) : Promise.resolve({ data: [], error: null }),
  ]);
  const billingSchemaPending = [paidCourses.error, paidPurchases.error].some((error) => error?.code === "PGRST202" || error?.code === "42883" || /Could not find the function|does not exist/i.test(error?.message ?? ""));
  if (members.error || invitations.error || courses.error || assignments.error || (!billingSchemaPending && (paidCourses.error || paidPurchases.error))) throw new Error("Unable to load company workspace details.");
  return { members: (members.data ?? []) as CompanyMember[], invitations: (invitations.data ?? []) as CompanyManagerInvitation[], courses: (courses.data ?? []) as CompanyAssignableCourse[], assignments: (assignments.data ?? []) as CompanyCourseAssignment[], paidCourses: (paidCourses.data ?? []) as CompanyPaidCourse[], paidPurchases: (paidPurchases.data ?? []) as CompanyPaidCoursePurchase[], paidBillingAvailable: !billingSchemaPending };
}

export async function getOwnCompanyAssignedCourses() {
  const { data, error } = await (await createClient()).rpc("list_own_learning_company_assigned_courses");
  if (error) throw new Error("Unable to load assigned company courses.");
  return (data ?? []) as CompanyAssignedCourse[];
}
