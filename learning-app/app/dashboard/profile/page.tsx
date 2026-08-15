import { redirect } from "next/navigation";
import { ProfileSettingsForm } from "@/app/components/profile-settings-form";
import { ProfileMediaUploadButton } from "@/app/components/profile-media-upload-button";
import { isLearningAdmin } from "@/app/lib/admin/authorization";
import { isApprovedInstructor } from "@/app/lib/instructor/authorization";
import { getOwnLearningProfile } from "@/app/lib/learning-profile";

export const metadata = { title: "Your profile" };

export default async function DashboardProfilePage() {
  const [profile, isInstructor, isAdmin] = await Promise.all([
    getOwnLearningProfile(),
    isApprovedInstructor(),
    isLearningAdmin(),
  ]);

  if (!profile) redirect("/sign-in");

  const initial = profile.fullName.charAt(0).toUpperCase() || "G";
  const role = isAdmin
    ? "Growvelt Learning Admin"
    : isInstructor
      ? "Approved Instructor"
      : "Learner";
  const setupSteps = [
    { label: "Display name", complete: profile.fullName !== "Growvelt learner" },
    { label: "Verified email", complete: true },
    { label: "Profile image", complete: Boolean(profile.avatarUrl) },
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
          <p className="eyebrow">Growvelt Learning member</p>
          <ProfileSettingsForm
            userId={profile.id}
            email={profile.email}
            fullName={profile.fullName}
          />
          <p className="profile-role">{role}</p>
          <div className="profile-identity-meta">
            <span>{profile.email}</span>
            <span>Private account</span>
          </div>
        </div>
      </section>

      <section className="profile-setup-card" aria-labelledby="profile-setup-title">
        <div className="profile-setup-heading">
          <div>
            <p className="eyebrow">Profile set-up</p>
            <h2 id="profile-setup-title">Keep your account ready for Learning</h2>
          </div>
          <strong>{setupPercent}%</strong>
        </div>
        <div
          className="profile-setup-progress"
          role="progressbar"
          aria-label="Profile set-up"
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
          <p className="eyebrow">Learning identity</p>
          <h2>Recognisable and personal</h2>
          <p>
            Your display name is used in your signed-in Learning experience and
            on certificates issued to you.
          </p>
        </article>
        <article>
          <p className="eyebrow">Account privacy</p>
          <h2>Built for your account only</h2>
          <p>
            Your email remains private. It is not shown on public certificate
            verification pages or course pages.
          </p>
        </article>
      </section>

    </section>
  );
}
