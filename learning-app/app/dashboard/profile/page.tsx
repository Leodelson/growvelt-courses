import { redirect } from "next/navigation";
import { ProfileSettingsForm } from "@/app/components/profile-settings-form";
import { ProfileMediaUploadButton } from "@/app/components/profile-media-upload-button";
import { ProfileSocialLinksForm } from "@/app/components/profile-social-links-form";
import { isLearningAdmin } from "@/app/lib/admin/authorization";
import { isApprovedInstructor } from "@/app/lib/instructor/authorization";
import { getOwnLearningProfile } from "@/app/lib/learning-profile";
import { getRequestLocale } from "@/app/lib/i18n-server";
import { translate } from "@/app/lib/i18n";

export const metadata = { title: "Your profile" };

export default async function DashboardProfilePage() {
  const [profile, isInstructor, isAdmin, locale] = await Promise.all([
    getOwnLearningProfile(),
    isApprovedInstructor(),
    isLearningAdmin(),
    getRequestLocale(),
  ]);

  if (!profile) redirect("/sign-in");
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  const initial = profile.fullName.charAt(0).toUpperCase() || "G";
  const role = isAdmin
    ? t("profile.admin")
    : isInstructor
      ? t("profile.instructor")
      : t("profile.learner");
  const setupSteps = [
    { label: t("profile.displayName"), complete: profile.fullName !== "Growvelt learner" },
    { label: t("profile.verifiedEmail"), complete: true },
    { label: t("profile.image"), complete: Boolean(profile.avatarUrl) },
  ];
  const completedSteps = setupSteps.filter((step) => step.complete).length;
  const setupPercent = Math.round((completedSteps / setupSteps.length) * 100);

  return (
    <section className="profile-page section-shell">
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

      <section className="profile-identity-card" aria-labelledby="profile-name">
        <div className="profile-avatar-preview" aria-hidden="true">
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
            <span className={step.complete ? "is-complete" : ""} key={step.label}>
              {step.complete ? "✓" : "○"} {step.label}
            </span>
          ))}
        </div>
      </section>

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

      <ProfileSocialLinksForm userId={profile.id} links={{ linkedinUrl: profile.linkedinUrl, websiteUrl: profile.websiteUrl, instagramUrl: profile.instagramUrl, facebookUrl: profile.facebookUrl, xUrl: profile.xUrl }} />

    </section>
  );
}
