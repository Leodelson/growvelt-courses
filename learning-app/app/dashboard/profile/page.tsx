import Link from "@/app/components/learning-link";
import { redirect } from "next/navigation";
import { ProfileSettingsForm } from "@/app/components/profile-settings-form";
import { ProfileMediaUploadButton } from "@/app/components/profile-media-upload-button";
import { ProfileSocialLinksForm } from "@/app/components/profile-social-links-form";
import { isLearningAdmin } from "@/app/lib/admin/authorization";
import { isApprovedInstructor } from "@/app/lib/instructor/authorization";
import { getOwnLearningProfile } from "@/app/lib/learning-profile";
import { getOwnInstructorOrganizationProfileBranding, getOwnInstructorOrganizationProfiles, getOwnInstructorOrganizations, getOwnInstructorOrganizationVerifications } from "@/app/lib/instructor/organizations";
import { getRequestLocale } from "@/app/lib/i18n-server";
import { translate } from "@/app/lib/i18n";
import { VerifiedProviderBadge } from "@/app/components/verified-provider-badge";
import { createClient } from "@/app/lib/supabase/server";

import { accountCopy } from "@/app/lib/learning/account-workspace";
import styles from "@/app/components/learning/account-workspace.module.css";

export const metadata = { title: "Your profile" };

export default async function DashboardProfilePage() {
  const [profile, isInstructor, isAdmin, locale, organizations, verifications, providerProfiles] = await Promise.all([
    getOwnLearningProfile(),
    isApprovedInstructor(),
    isLearningAdmin(),
    getRequestLocale(),
    getOwnInstructorOrganizations().catch(() => []),
    getOwnInstructorOrganizationVerifications().catch(() => []),
    getOwnInstructorOrganizationProfiles().catch(() => []),
  ]);

  if (!profile) redirect("/sign-in");
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  const text = accountCopy[locale];
  const socialLinkCount = [profile.linkedinUrl, profile.websiteUrl, profile.instagramUrl, profile.facebookUrl, profile.xUrl].filter(Boolean).length;
  const initial = profile.fullName.charAt(0).toUpperCase() || "G";
  const role = isAdmin
    ? t("profile.admin")
    : isInstructor
      ? t("profile.instructor")
      : t("profile.learner");
  const setupSteps = [
    { label: t("profile.displayName"), complete: profile.fullName !== "Growvelt learner", href: "#profile-identity" },
    { label: text.email, complete: Boolean(profile.email), href: "#profile-identity" },
    { label: t("profile.image"), complete: Boolean(profile.avatarUrl), href: "#profile-identity" },
  ];
  const completedSteps = setupSteps.filter((step) => step.complete).length;
  const setupPercent = Math.round((completedSteps / setupSteps.length) * 100);
  const managedProviders = organizations.filter((organization) => organization.membership_role === "owner" && organization.membership_status === "active" && organization.organization_status === "active");
  const providerBrandings = await Promise.all(managedProviders.map(async (organization) => ({ organizationId: organization.organization_id, profile: await getOwnInstructorOrganizationProfileBranding(organization.organization_id).catch(() => null) })));
  const supabase = await createClient();
  const providerLogos = await Promise.all(providerBrandings.map(async ({ organizationId, profile }) => ({ organizationId, url: profile?.logo_storage_path ? (await supabase.storage.from("learning-provider-media").createSignedUrl(profile.logo_storage_path, 60 * 60)).data?.signedUrl ?? null : null })));

  return (
    <section className={`profile-page section-shell ${styles.page} ${styles.profile}`} aria-labelledby="account-profile-title">
      <div className={styles.header}><div><p className="eyebrow">{t("profile.member")}</p><h1 id="account-profile-title">{text.profile}</h1><p>{text.profileIntro}</p></div><Link href="/dashboard/settings" className="button button-secondary">{text.settings}</Link></div>
      <nav className={styles.profileNav} aria-label={text.profile}><a href="#profile-identity">{text.identity}</a><a href="#profile-setup-title">{text.profileChecklist}</a><a href="#profile-links">{text.links}</a></nav>
      <header
        className="profile-cover"
      >
        {profile.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="profile-cover-image" src={profile.coverUrl} alt="" />
        ) : null}
        <div className="profile-cover-pattern" aria-hidden="true" />
        <ProfileMediaUploadButton
          userId={profile.id}
          kind="cover"
          currentPath={profile.coverStoragePath}
          className="profile-cover-change"
        />
      </header>

      <section id="profile-identity" className="profile-identity-card" aria-labelledby="profile-name">
        <div className="profile-avatar-preview">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatarUrl} alt="" />
          ) : (
            initial
          )}
          <ProfileMediaUploadButton
            userId={profile.id}
            kind="avatar"
            currentPath={profile.avatarStoragePath}
            className="profile-avatar-change"
          />
        </div>
        <div className="profile-identity-copy">
          <p className="eyebrow">{t("profile.member")}</p>
          <ProfileSettingsForm
            userId={profile.id}
            email={profile.email}
            fullName={profile.fullName}
          />
          <p className="profile-role">{role}</p>
          <div className="profile-identity-meta">
            <span>{profile.email}</span>
            <span>{t("profile.private")}</span>
          </div>
        </div>
      </section>

      {managedProviders.map((organization) => {
        const providerProfile = providerProfiles.find((item) => item.organization_id === organization.organization_id);
        const logoUrl = providerLogos.find((item) => item.organizationId === organization.organization_id)?.url;
        return <section className="profile-provider-card" key={organization.organization_id} aria-labelledby={`provider-profile-${organization.organization_id}`}>
          <div className="profile-provider-mark" aria-hidden="true">{logoUrl ? <img src={logoUrl} alt="" /> : organization.name.charAt(0).toUpperCase() || "G"}</div>
          <div><p className="eyebrow">Provider organization</p><h2 id={`provider-profile-${organization.organization_id}`}>{organization.name} {verifications.some((verification) => verification.organization_id === organization.organization_id && verification.status === "verified") && <VerifiedProviderBadge />}</h2><p>{providerProfile ? "Your provider profile is connected to this owner account." : "Set up this organization’s details, cover, and logo, then submit it for verification when ready."}</p></div>
          <Link className="button button-primary" href={`/dashboard/instructor/organizations/${organization.organization_id}/profile`}>Manage provider profile <span aria-hidden="true">↗</span></Link>
        </section>;
      })}

      <section className="profile-setup-card" aria-labelledby="profile-setup-title">
        <div className="profile-setup-heading">
          <div>
            <p className="eyebrow">{t("profile.setup")}</p>
            <h2 id="profile-setup-title">{t("profile.setupTitle")}</h2>
          </div>
          <strong>{setupPercent}%</strong>
        </div>
        <div
          className="profile-setup-progress"
          role="progressbar"
          aria-label={t("profile.setupProgress")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={setupPercent}
        >
          <span style={{ width: `${setupPercent}%` }} />
        </div>
        <div className="profile-setup-steps">
          {setupSteps.map((step) => (
            <a href={step.href} className={step.complete ? "is-complete" : ""} key={step.label}>
              {step.complete ? "✓" : "○"} {step.label}
            </a>
          ))}
        </div>
        <p className={styles.hint}>{text.profileHint}</p>
      </section>

      <div className={styles.stats}><div className={styles.stat}><div><strong>{Number(Boolean(profile.avatarUrl)) + Number(Boolean(profile.coverUrl))} / 2</strong><span>{text.photos}</span></div></div><div className={styles.stat}><div><strong>{socialLinkCount} / 5</strong><span>{text.linksCount}</span></div></div></div>

      <section className="profile-details-grid" aria-label="Learning profile details">
        <article>
          <p className="eyebrow">{t("profile.identity")}</p>
          <h2>{t("profile.identityTitle")}</h2>
          <p>{t("profile.identityCopy")}</p>
        </article>
        <article>
          <p className="eyebrow">{t("profile.privacy")}</p>
          <h2>{t("profile.privacyTitle")}</h2>
          <p>{t("profile.privacyCopy")}</p>
        </article>
      </section>

      <div id="profile-links"><ProfileSocialLinksForm userId={profile.id} links={{ linkedinUrl: profile.linkedinUrl, websiteUrl: profile.websiteUrl, instagramUrl: profile.instagramUrl, facebookUrl: profile.facebookUrl, xUrl: profile.xUrl }} /></div>

    </section>
  );
}
