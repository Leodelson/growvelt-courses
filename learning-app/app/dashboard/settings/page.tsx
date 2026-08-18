import { ThemeControl } from "@/app/components/theme-control";
import Link from "next/link";
import { DeleteAccountControl } from "@/app/components/auth/delete-account-control";
import { LanguageControl } from "@/app/components/language-control";
import { isLearningAdmin } from "@/app/lib/admin/authorization";
import { getOwnInstructorApplication } from "@/app/lib/instructor/application";
import { getOwnLearningProfile } from "@/app/lib/learning-profile";
import { getRequestLocale } from "@/app/lib/i18n-server";
import { translate } from "@/app/lib/i18n";

export default async function DashboardSettingsPage() {
  const [profile, instructorApplication, isAdmin, locale] = await Promise.all([getOwnLearningProfile(), getOwnInstructorApplication(), isLearningAdmin(), getRequestLocale()]);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const instructorStatus = instructorApplication?.approval_status ?? null;
  const accountRole = isAdmin ? t("settings.roleAdmin") : instructorStatus === "approved" ? t("settings.roleInstructor") : instructorStatus === "pending" ? t("settings.roleApplicant") : t("settings.roleLearner");
  const roleCopy = isAdmin ? t("settings.adminCopy") : instructorStatus === "approved" ? t("settings.instructorCopy") : instructorStatus === "pending" ? t("settings.applicantCopy") : t("settings.learnerCopy");
  return <>
    <header className="settings-hero"><p className="eyebrow">{t("settings.eyebrow")}</p><h1>{t("settings.title")}</h1><p>{t("settings.summary")}</p><div className="settings-hero-pills"><span>{t("settings.account")}</span><span>{accountRole}</span><span>{t("settings.signedIn")}</span></div></header>
    <div className="settings-stack">
      <div className="settings-summary-grid"><section className="settings-feature-card"><p className="eyebrow">{t("settings.account")}</p><h2>{profile?.fullName || "Growvelt"}</h2><p>{profile?.email || "—"}</p><Link className="button button-primary" href="/dashboard/profile">{t("settings.manageProfile")}</Link></section><section className="settings-feature-card settings-role-card"><p className="eyebrow">{t("settings.access")}</p><h2>{accountRole}</h2><p>{roleCopy}</p>{instructorStatus === "approved" ? <Link className="button button-secondary" href="/dashboard/instructor">{t("settings.openWorkspace")}</Link> : instructorStatus === "pending" ? <Link className="button button-secondary" href="/teach/application">{t("settings.viewApplication")}</Link> : <Link className="button button-secondary" href="/teach">{t("nav.teach")}</Link>}</section></div>
      <section className="settings-card settings-card-expanded" aria-labelledby="language-title"><div><p className="eyebrow">{t("settings.language")}</p><h2 id="language-title">{t("settings.languageTitle")}</h2><p>{t("settings.languageCopy")}</p></div><LanguageControl /></section>
      <section className="settings-card settings-card-expanded" aria-labelledby="appearance-title"><div><p className="eyebrow">{t("settings.appearance")}</p><h2 id="appearance-title">{t("settings.appearanceTitle")}</h2><p>{t("settings.appearanceCopy")}</p></div><ThemeControl /></section>
      <section className="settings-card" aria-labelledby="profile-title"><div><p className="eyebrow">{t("settings.profile")}</p><h2 id="profile-title">{t("settings.profileTitle")}</h2><p>{profile ? `${profile.fullName} is connected to this account.` : "—"}</p></div><Link className="button button-secondary" href="/dashboard/profile">{t("settings.editProfile")}</Link></section>
      <section className="settings-card" aria-labelledby="security-title"><div><p className="eyebrow">{t("settings.security")}</p><h2 id="security-title">{t("settings.securityTitle")}</h2><p>{t("settings.securityCopy")}</p></div><Link className="button button-secondary" href="/forgot-password">{t("settings.resetPassword")}</Link></section>
      <section className="settings-card settings-danger-card" aria-labelledby="danger-title"><div><p className="eyebrow">{t("settings.danger")}</p><h2 id="danger-title">{t("settings.deleteTitle")}</h2><p>{t("settings.deleteCopy")}</p></div><DeleteAccountControl /></section>
    </div>
  </>;
}
