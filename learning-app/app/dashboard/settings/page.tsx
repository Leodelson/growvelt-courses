import { ThemeControl } from "@/app/components/theme-control";
import Link from "@/app/components/learning-link";
import { DeleteAccountControl } from "@/app/components/auth/delete-account-control";
import { LanguageControl } from "@/app/components/language-control";
import { isLearningAdmin } from "@/app/lib/admin/authorization";
import { getOwnInstructorApplication } from "@/app/lib/instructor/application";
import { getOwnLearningProfile } from "@/app/lib/learning-profile";
import { getRequestLocale } from "@/app/lib/i18n-server";
import { translate } from "@/app/lib/i18n";

import { AccountSections } from "@/app/components/learning/account-sections";
import { CookieSettingsButton } from "@/app/components/privacy/cookie-settings-button";
import { accountCopy } from "@/app/lib/learning/account-workspace";
import styles from "@/app/components/learning/account-workspace.module.css";

export const metadata = { title: "Account settings" };

export default async function DashboardSettingsPage() {
  const [profile, instructorApplication, isAdmin, locale] = await Promise.all([getOwnLearningProfile(), getOwnInstructorApplication(), isLearningAdmin(), getRequestLocale()]);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const text = accountCopy[locale];
  const instructorStatus = instructorApplication?.approval_status ?? null;
  const accountRole = isAdmin ? t("settings.roleAdmin") : instructorStatus === "approved" ? t("settings.roleInstructor") : instructorStatus === "pending" ? t("settings.roleApplicant") : t("settings.roleLearner");
  const roleCopy = isAdmin ? t("settings.adminCopy") : instructorStatus === "approved" ? t("settings.instructorCopy") : instructorStatus === "pending" ? t("settings.applicantCopy") : t("settings.learnerCopy");
  return <section className={styles.page} aria-labelledby="account-settings-title">
    <header className="settings-hero"><p className="eyebrow">{t("settings.eyebrow")}</p><h1 id="account-settings-title">{t("settings.title")}</h1><p>{t("settings.summary")}</p><div className="settings-hero-pills"><span>{t("settings.account")}</span><span>{accountRole}</span><span>{t("settings.signedIn")}</span></div></header>
    <div className="settings-summary-grid"><section className="settings-feature-card"><p className="eyebrow">{t("settings.account")}</p><h2>{profile?.fullName || "Growvelt"}</h2><p>{profile?.email || "—"}</p><Link className="button button-primary" href="/dashboard/profile">{t("settings.manageProfile")}</Link></section><section className="settings-feature-card settings-role-card"><p className="eyebrow">{t("settings.access")}</p><h2>{accountRole}</h2><p>{roleCopy}</p>{instructorStatus === "approved" ? <Link className="button button-secondary" href="/dashboard/instructor">{t("settings.openWorkspace")}</Link> : instructorStatus === "pending" ? <Link className="button button-secondary" href="/teach/application">{t("settings.viewApplication")}</Link> : <Link className="button button-secondary" href="/teach">{t("nav.teach")}</Link>}</section></div>
    <AccountSections sections={[
      { id: "language", title: t("settings.language"), keywords: t("settings.languageCopy"), content: <section className="settings-card settings-card-expanded" aria-labelledby="language-title"><div><p className="eyebrow">{t("settings.language")}</p><h2 id="language-title">{t("settings.languageTitle")}</h2><p>{t("settings.languageCopy")}</p></div><LanguageControl /></section> },
      { id: "appearance", title: t("settings.appearance"), keywords: t("settings.appearanceCopy"), content: <section className="settings-card settings-card-expanded" aria-labelledby="appearance-title"><div><p className="eyebrow">{t("settings.appearance")}</p><h2 id="appearance-title">{t("settings.appearanceTitle")}</h2><p>{t("settings.appearanceCopy")}</p></div><ThemeControl /></section> },
      { id: "privacy", title: text.cookies, keywords: text.cookieCopy, content: <section className="settings-card" aria-labelledby="cookies-title"><div><p className="eyebrow">{text.privacy}</p><h2 id="cookies-title">{text.cookies}</h2><p>{text.cookieCopy}</p></div><div className={styles.cookieActions}><CookieSettingsButton /><Link href="/privacy-policy">{text.privacy}</Link></div></section> },
      { id: "security", title: t("settings.security"), keywords: t("settings.securityCopy"), content: <section className="settings-card" aria-labelledby="security-title"><div><p className="eyebrow">{t("settings.security")}</p><h2 id="security-title">{t("settings.securityTitle")}</h2><p>{t("settings.securityCopy")}</p></div><Link className="button button-secondary" href="/forgot-password">{t("settings.resetPassword")}</Link></section> },
      { id: "account", title: t("settings.danger"), keywords: t("settings.deleteCopy"), content: <section className="settings-card settings-danger-card" aria-labelledby="danger-title"><div><p className="eyebrow">{t("settings.danger")}</p><h2 id="danger-title">{t("settings.deleteTitle")}</h2><p>{t("settings.deleteCopy")}</p></div><DeleteAccountControl /></section> },
    ]} />
  </section>;
}
