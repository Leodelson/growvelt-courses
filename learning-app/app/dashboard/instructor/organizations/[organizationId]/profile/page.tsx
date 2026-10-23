import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OrganizationProfileForm } from "@/app/components/instructor/organization-profile-form";
import { OrganizationProfileMediaUploadButton } from "@/app/components/instructor/organization-profile-media-upload-button";
import { OrganizationVerificationForm } from "@/app/components/instructor/organization-verification-form";
import { isApprovedInstructor } from "@/app/lib/instructor/authorization";
import { getOwnInstructorOrganizationProfileBranding, getOwnInstructorOrganizationVerifications, getOwnInstructorOrganizations } from "@/app/lib/instructor/organizations";
import { createClient } from "@/app/lib/supabase/server";
import { VerifiedProviderBadge } from "@/app/components/verified-provider-badge";
import { Eye } from "lucide-react";

import { providerSetupChecklist } from "@/app/lib/instructor/provider-workspaces";
import styles from "@/app/components/instructor/provider-workspaces.module.css";

export const metadata = { title: "Manage provider profile" };

export default async function ManageProviderProfilePage({ params }: { params: Promise<{ organizationId: string }> }) {
  if (!await isApprovedInstructor()) redirect("/teach/application");
  const organizationId = Number((await params).organizationId);
  if (!Number.isSafeInteger(organizationId) || organizationId < 1) notFound();
  const [organizations, verifications] = await Promise.all([getOwnInstructorOrganizations(), getOwnInstructorOrganizationVerifications()]);
  const organization = organizations.find((item) => item.organization_id === organizationId && item.membership_role === "owner" && item.membership_status === "active" && item.organization_status === "active");
  const verification = verifications.find((item) => item.organization_id === organizationId);
  if (!organization) notFound();
  const profile = await getOwnInstructorOrganizationProfileBranding(organizationId);
  const supabase = await createClient();
  const [logoMedia, coverMedia] = await Promise.all([
    profile?.logo_storage_path ? supabase.storage.from("learning-provider-media").createSignedUrl(profile.logo_storage_path, 60 * 60) : Promise.resolve({ data: null }),
    profile?.cover_storage_path ? supabase.storage.from("learning-provider-media").createSignedUrl(profile.cover_storage_path, 60 * 60) : Promise.resolve({ data: null }),
  ]);
  const initial = organization.name.trim().charAt(0).toUpperCase() || "G";
  const checklist = providerSetupChecklist(profile, verification?.status === "verified");
  const completion = Math.round((checklist.filter((item) => item.complete).length / checklist.length) * 100);

  return <section className={`provider-manager-page section-shell ${styles.page}`}>
    <Link className={styles.back} href="/dashboard/instructor/organizations">← Back to organizations</Link>
    <header className="provider-manager-top"><div><p className="eyebrow">Provider profile</p><h1>Manage {organization.name}</h1><p>Prepare your provider identity, logo, cover, and public details here. An unverified profile stays private. Changes to an already verified profile update its public page.</p></div></header>
    <nav className={styles.jump} aria-label="Provider profile sections"><a href="#provider-branding">Branding</a><a href="#provider-details">Provider details</a><a href="#provider-verification">Verification</a></nav>
    <section className="provider-manager-cover" id="provider-branding">
      {coverMedia.data?.signedUrl && <img className="provider-manager-cover-image" src={coverMedia.data.signedUrl} alt="" />}
      <div className="provider-manager-cover-pattern" aria-hidden="true" />
      {profile ? <OrganizationProfileMediaUploadButton organizationId={organizationId} kind="cover" currentPath={profile.cover_storage_path} className="provider-manager-cover-change" /> : <p className="provider-manager-media-note">Save the provider details below before adding a cover image.</p>}
    </section>
    <section className="provider-manager-identity-card">
      <div className="provider-manager-logo">{logoMedia.data?.signedUrl ? <img src={logoMedia.data.signedUrl} alt="" /> : initial}{profile && <OrganizationProfileMediaUploadButton organizationId={organizationId} kind="logo" currentPath={profile.logo_storage_path} className="provider-manager-logo-change" />}</div>
      <div><p className="eyebrow">{verification?.status === "verified" ? "Verified training provider" : "Provider profile draft"}</p><h2>{organization.name} {verification?.status === "verified" && <VerifiedProviderBadge />}</h2><p>{profile?.headline || "Set up your provider profile so learners can understand what your organization offers."}</p></div>
      <div className="provider-manager-actions">{profile && verification?.status === "verified" && <Link className="button button-secondary provider-manager-preview" href={`/providers/${organization.slug}`}><Eye aria-hidden="true" size={17} />Preview provider profile</Link>}<Link className="button button-primary" href={`/dashboard/instructor/organizations/${organizationId}/insights`}>Organization insights</Link></div>
    </section>
    <section className="provider-manager-editor" id="provider-details"><header><p className="eyebrow">Provider details</p><h2>Tell learners about your provider</h2><p>Required fields are marked with an asterisk. Save a draft any time; it will be public only after verification is approved.</p></header><div className="provider-manager-editor-grid"><OrganizationProfileForm organizationId={organizationId} profile={profile ?? undefined} isVerified={verification?.status === "verified"} /><aside className="provider-manager-completion"><div className="provider-manager-completion-head"><h3>Saved setup progress</h3><strong>{completion}%</strong></div><div className="provider-manager-progress" aria-hidden="true"><span style={{ width: `${completion}%` }} /></div><p>This reflects saved setup steps, not unsaved form changes or publication eligibility. Images are optional; only Growvelt Admin can approve verification.</p><ul>{checklist.map((item) => <li key={item.label} className={item.complete ? "is-complete" : ""}><span aria-hidden="true">{item.complete ? "✓" : "○"}</span><a href={item.href}>{item.label}</a></li>)}</ul></aside></div></section>
    <section className="provider-manager-verification" id="provider-verification"><header><p className="eyebrow">Verification</p><h2>Make this profile public</h2><p>Growvelt Admin reviews the provider details privately. Once approved, your profile, logo, cover, and organization-owned courses can show the verified provider badge.</p></header><OrganizationVerificationForm organizationId={organizationId} verification={verification} /></section>
  </section>;
}
