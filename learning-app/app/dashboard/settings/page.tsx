import { ThemeControl } from "@/app/components/theme-control";
import Link from "next/link";
import { DeleteAccountControl } from "@/app/components/auth/delete-account-control";
import { isLearningAdmin } from "@/app/lib/admin/authorization";
import { getOwnInstructorApplication } from "@/app/lib/instructor/application";
import { getOwnLearningProfile } from "@/app/lib/learning-profile";

export default async function DashboardSettingsPage() {
  const [profile, instructorApplication, isAdmin] = await Promise.all([getOwnLearningProfile(), getOwnInstructorApplication(), isLearningAdmin()]);
  const instructorStatus = instructorApplication?.approval_status ?? null;
  const accountRole = isAdmin ? "Learning Administrator" : instructorStatus === "approved" ? "Approved Instructor" : instructorStatus === "pending" ? "Instructor applicant" : "Learner";
  const roleCopy = isAdmin ? "You can review approved Growvelt Learning operations." : instructorStatus === "approved" ? "You can create and manage courses while continuing to learn." : instructorStatus === "pending" ? "Your Instructor application is under review. You can continue learning while you wait." : "Learn practical skills, track progress, and apply to teach when you are ready.";
  return <>
    <header className="settings-hero"><p className="eyebrow">Preferences and controls</p><h1>Your Learning settings.</h1><p>Manage your profile, access, appearance, and account security from one place.</p><div className="settings-hero-pills"><span>Learning account</span><span>{accountRole}</span><span>Signed in</span></div></header>
    <div className="settings-stack">
      <div className="settings-summary-grid"><section className="settings-feature-card"><p className="eyebrow">Learning account</p><h2>{profile?.fullName || "Your Growvelt account"}</h2><p>{profile?.email || "Your account is securely connected."}</p><Link className="button button-primary" href="/dashboard/profile">Manage profile</Link></section><section className="settings-feature-card settings-role-card"><p className="eyebrow">Account access</p><h2>{accountRole}</h2><p>{roleCopy}</p>{instructorStatus === "approved" ? <Link className="button button-secondary" href="/dashboard/instructor">Open Instructor workspace</Link> : instructorStatus === "pending" ? <Link className="button button-secondary" href="/teach/application">View application</Link> : <Link className="button button-secondary" href="/teach">Teach on Growvelt</Link>}</section></div>
      <section className="settings-card settings-card-expanded" aria-labelledby="appearance-title"><div><p className="eyebrow">Appearance</p><h2 id="appearance-title">Choose your preferred view</h2><p>Your theme choice is saved locally on this device.</p></div><ThemeControl /></section>
      <section className="settings-card" aria-labelledby="profile-title"><div><p className="eyebrow">Profile</p><h2 id="profile-title">How you appear in Learning</h2><p>{profile ? `${profile.fullName} is connected to this account.` : "Your authenticated account is connected."}</p></div><Link className="button button-secondary" href="/dashboard/profile">Edit profile</Link></section>
      <section className="settings-card" aria-labelledby="security-title"><div><p className="eyebrow">Account security</p><h2 id="security-title">Change your password</h2><p>Use the secure recovery flow to set a new password. Google sign-in accounts can manage their password with Google.</p></div><Link className="button button-secondary" href="/forgot-password">Reset password</Link></section>
      <section className="settings-card settings-danger-card" aria-labelledby="danger-title"><div><p className="eyebrow">Danger zone</p><h2 id="danger-title">Delete your account</h2><p>Permanently remove your Learning profile and related account data. This action cannot be undone.</p></div><DeleteAccountControl /></section>
    </div>
  </>;
}
