import { redirect } from "next/navigation";
import { OrganizationCreateForm } from "@/app/components/instructor/organization-create-form";
import { OrganizationInvitationAcceptance, OrganizationInvitationForm } from "@/app/components/instructor/organization-invitation-controls";
import { isApprovedInstructor } from "@/app/lib/instructor/authorization";
import { getOwnInstructorOrganizationInvitations, getOwnInstructorOrganizations } from "@/app/lib/instructor/organizations";

export const metadata = { title: "Training organizations" };

export default async function InstructorOrganizationsPage() {
  if (!await isApprovedInstructor()) redirect("/teach/application");
  const [organizations, invitations] = await Promise.all([getOwnInstructorOrganizations(), getOwnInstructorOrganizationInvitations()]);
  return <section className="instructor-earnings-page section-shell">
    <header className="instructor-earnings-hero"><p className="eyebrow">Training organizations</p><h1>Build a provider workspace for your training team.</h1><p>Start with an organization identity and founder ownership. Member invitations, shared course ownership, branding, analytics, commerce, and payouts are introduced in later phases.</p></header>
    <section className="organization-panel"><header><p className="eyebrow">Create organization</p><h2>Set up your provider identity</h2><p>Only approved instructors can create an organization. Your existing individual courses and earnings remain unchanged.</p></header><OrganizationCreateForm /></section>
    <section className="organization-panel"><header><p className="eyebrow">Your memberships</p><h2>Organization access</h2></header>{organizations.length ? <div className="organization-list">{organizations.map((organization) => <article key={organization.organization_id}><div><strong>{organization.name}</strong><span>/{organization.slug}</span></div><div><span>{organization.membership_role}</span><span>{organization.membership_status}</span><span>{organization.organization_status}</span></div>{organization.membership_role === "owner" && organization.membership_status === "active" && organization.organization_status === "active" ? <OrganizationInvitationForm organizationId={organization.organization_id} /> : null}</article>)}</div> : <p className="organization-empty">You have not created or joined a training organization yet.</p>}</section>
    {invitations.length > 0 && <section className="organization-panel"><header><p className="eyebrow">Pending invitations</p><h2>Join a training organization</h2><p>Accepting an invitation adds you as an approved instructor member. It does not transfer course ownership or change earnings.</p></header><div className="organization-list">{invitations.map((invitation) => <article key={invitation.invitation_id}><div><strong>{invitation.organization_name}</strong><span>{invitation.role} invitation · expires {new Date(invitation.expires_at).toLocaleDateString("en-NG")}</span></div><OrganizationInvitationAcceptance invitationId={invitation.invitation_id} /></article>)}</div></section>}
  </section>;
}
