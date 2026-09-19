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

export type OrganizationMember = { member_id: string; full_name: string | null; email: string; role: "owner" | "admin" | "instructor"; status: "active" | "suspended" | "revoked"; granted_at: string };
export type OrganizationOwnerInvitation = { invitation_id: number; invited_email: string; role: "admin" | "instructor"; status: "pending" | "accepted" | "cancelled" | "expired"; created_at: string; expires_at: string; responded_at: string | null };
export type OrganizationCourse = { course_id: number; title: string; slug: string; status: string; instructor_name: string; updated_at: string };

export async function getInstructorOrganizationManagement(organization: InstructorOrganization) {
  const supabase = await createClient();
  const [members, courses, invitations] = await Promise.all([
    supabase.rpc("list_own_learning_provider_organization_members", { p_organization_id: organization.organization_id }),
    supabase.rpc("list_own_learning_provider_organization_courses", { p_organization_id: organization.organization_id }),
    organization.membership_role === "owner" && organization.membership_status === "active" && organization.organization_status === "active"
      ? supabase.rpc("list_own_learning_provider_organization_invitations_as_owner", { p_organization_id: organization.organization_id })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (members.error || courses.error || invitations.error) throw new Error("Unable to load organization management details.");
  return { members: (members.data ?? []) as OrganizationMember[], courses: (courses.data ?? []) as OrganizationCourse[], invitations: (invitations.data ?? []) as OrganizationOwnerInvitation[] };
}
