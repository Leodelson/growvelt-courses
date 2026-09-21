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
  const [members, invitations] = await Promise.all([
    supabase.rpc("list_own_learning_company_members", { p_workspace_id: workspace.workspace_id }),
    workspace.membership_role === "owner" || workspace.membership_role === "admin"
      ? supabase.rpc("list_own_learning_company_invitations_as_manager", { p_workspace_id: workspace.workspace_id })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (members.error || invitations.error) throw new Error("Unable to load company workspace details.");
  return { members: (members.data ?? []) as CompanyMember[], invitations: (invitations.data ?? []) as CompanyManagerInvitation[] };
}
