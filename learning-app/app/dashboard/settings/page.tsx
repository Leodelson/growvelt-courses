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
import { createClient } from "@/app/lib/supabase/server";
import { LearningEmailPreferences } from "@/app/components/learning-email-preferences";

export const metadata = { title: "Account settings" };

export default async function DashboardSettingsPage() {
  const supabase = await createClient();
  const [profile, instructorApplication, isAdmin, locale, activityResult, emailPreference] = await Promise.all([getOwnLearningProfile(), getOwnInstructorApplication(), isLearningAdmin(), getRequestLocale(), supabase.from("learning_login_activity").select("id,sign_in_at,browser,device,country").order("sign_in_at", { ascending: false }).limit(8), supabase.from("learning_email_preferences").select("marketing_opt_in").maybeSingle()]);
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
      { id: "activity", title: "Sign-in activity", keywords: "Recent devices and browsers used to access this Learning account", content: <section className="settings-card" aria-labelledby="login-activity-title"><div><p className="eyebrow">Account security</p><h2 id="login-activity-title">Recent sign-ins</h2><p>These are sign-ins to Growvelt Learning only. If you do not recognize one, reset your password.</p></div>{activityResult.error ? <p>Sign-in history is temporarily unavailable.</p> : !activityResult.data?.length ? <p>Your recent sign-ins will appear here after the next sign-in.</p> : <ul className="learning-login-activity">{activityResult.data.map((item) => <li key={item.id}><strong>{item.browser} on {item.device}</strong><span>{new Date(item.sign_in_at).toLocaleString(locale === "fr" ? "fr-FR" : locale === "es" ? "es-ES" : "en-NG", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" })} WAT{item.country ? ` · ${item.country}` : ""}</span></li>)}</ul>}</section> },
      { id: "emails", title: "Email preferences", keywords: "Optional Learning news and offers", content: <section className="settings-card" aria-labelledby="email-preferences-title"><div><p className="eyebrow">Communication</p><h2 id="email-preferences-title">Email preferences</h2></div>{emailPreference.error ? <p>Email preferences are temporarily unavailable.</p> : <LearningEmailPreferences initialValue={emailPreference.data?.marketing_opt_in === true} />}</section> },
      { id: "account", title: t("settings.danger"), keywords: t("settings.deleteCopy"), content: <section className="settings-card settings-danger-card" aria-labelledby="danger-title"><div><p className="eyebrow">{t("settings.danger")}</p><h2 id="danger-title">{t("settings.deleteTitle")}</h2><p>{t("settings.deleteCopy")}</p></div><DeleteAccountControl /></section> },
    ]} />
  </section>;
}
