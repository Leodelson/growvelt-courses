import { createClient } from "@/app/lib/supabase/server";

export type InstructorOrganization = {
  organization_id: number;
  name: string;
  slug: string;
  organization_status: "active" | "suspended" | "archived";
  membership_role: "owner" | "admin" | "instructor";
  membership_status: "active" | "suspended" | "revoked";
  created_at: string;
};

export async function getOwnInstructorOrganizations() {
  const { data, error } = await (await createClient()).rpc("list_own_learning_provider_organizations");
  if (error) throw new Error("Unable to load training organizations.");
  return (data ?? []) as InstructorOrganization[];
}

export type InstructorOrganizationInvitation = {
  invitation_id: number;
  organization_id: number;
  organization_name: string;
  role: "admin" | "instructor";
  expires_at: string;
};

export async function getOwnInstructorOrganizationInvitations() {
  const { data, error } = await (await createClient()).rpc("list_own_learning_provider_organization_invitations");
  if (error) throw new Error("Unable to load organization invitations.");
  return (data ?? []) as InstructorOrganizationInvitation[];
}
