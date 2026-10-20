"use client";
import { careersAbsoluteUrl, internalLearningPath } from "@/app/lib/site-urls.mjs";

import Link from "@/app/components/learning-link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SignOutButton } from "@/app/components/auth/sign-out-button";
import { LearningIcon } from "@/app/components/learning-icon";
import { LearningMark } from "@/app/components/learning-mark";
import { SidebarBrandControls } from "@/app/components/sidebar-brand-controls";
import { ThemeControl } from "@/app/components/theme-control";
import { useLanguage } from "@/app/components/language-provider";
import { languageOptions } from "@/app/lib/i18n";
import { SkipLink } from "@/app/components/ui/skip-link";
import { LearningNotifications } from "@/app/components/learning-notifications";

import { isDashboardNavigationCurrent } from "@/app/lib/learning/overview";
import { useDashboardDrawer } from "@/app/components/learning/use-dashboard-drawer";
import styles from "@/app/components/learning/learning-shell.module.css";

const navigation = [
  { href: "/dashboard", labelKey: "nav.home" as const, icon: "home" as const },
  { href: "/dashboard/my-learning", labelKey: "nav.learning" as const, icon: "learning" as const },
  { href: "/dashboard/subscriptions", labelKey: "nav.subscriptions" as const, icon: "earnings" as const },
  { href: "/dashboard/explore", labelKey: "nav.explore" as const, mobileLabelKey: "nav.exploreMobile" as const, icon: "explore" as const },
  { href: careersAbsoluteUrl("/"), labelKey: "nav.jobs" as const, icon: "jobs" as const, external: true },
  { href: "/dashboard/saved-courses", labelKey: "nav.saved" as const, icon: "heart" as const },
  { href: "/dashboard/certificates", labelKey: "nav.certificates" as const, icon: "certificate" as const },
  { href: "/dashboard/company", labelKey: "nav.company" as const, icon: "company" as const },
];
const mobileNavigation = navigation.filter((item) => item.href !== "/dashboard/saved-courses" && item.href !== "/dashboard/company" && item.href !== "/dashboard/subscriptions");
const mobileInstructorNavigation = [
  { href: "/dashboard", labelKey: "nav.home" as const, icon: "home" as const },
  { href: "/dashboard/instructor/courses", label: "My courses", mobileLabel: "My Courses", icon: "courses" as const },
  { href: "/dashboard/instructor/courses/new", label: "Create course", mobileLabel: "Create Course", icon: "add-course" as const },
  { href: careersAbsoluteUrl("/"), label: "Jobs", mobileLabel: "Jobs", icon: "jobs" as const, external: true },
  { href: "/dashboard/instructor/earnings", label: "Earnings", icon: "earnings" as const },
];
const mobileCompanyNavigation = { href: "/dashboard/company", label: "Company", icon: "company" as const };

type WorkspaceAccess = { isInstructor: boolean; isAdmin: boolean; isCompany: boolean; showSubscriptionPlans: boolean };
type OpenPanel = "language" | "notifications" | "account" | "mobile" | null;
const sidebarPreferenceKey = "growvelt-learning-sidebar-collapsed";

function WorkspaceLinks({ isInstructor, isAdmin, isCompany, showSubscriptionPlans, pathname, onNavigate }: WorkspaceAccess & { pathname: string; onNavigate?: () => void }) {
  const { t } = useLanguage();
  if (!isInstructor && !isAdmin && !isCompany) return null;
  const isCurrent = (href: string) => isDashboardNavigationCurrent(pathname, href);

  return <nav className="workspace-links" aria-label="Available workspaces">
    {isInstructor && <section><p className="eyebrow">{t("nav.instructor")}</p><Link data-tooltip={t("nav.instructor")} onClick={onNavigate} href="/dashboard/instructor" aria-current={isCurrent("/dashboard/instructor") ? "page" : undefined}><LearningIcon name="instructor-review" /><span>{t("nav.instructor")}</span></Link><Link data-tooltip={t("nav.courses")} onClick={onNavigate} href="/dashboard/instructor/courses" aria-current={isCurrent("/dashboard/instructor/courses") ? "page" : undefined}><LearningIcon name="courses" /><span>{t("nav.courses")}</span></Link><Link data-tooltip="Organizations" onClick={onNavigate} href="/dashboard/instructor/organizations" aria-current={isCurrent("/dashboard/instructor/organizations") ? "page" : undefined}><LearningIcon name="organization" /><span>Organizations</span></Link><Link data-tooltip="Earnings" onClick={onNavigate} href="/dashboard/instructor/earnings" aria-current={isCurrent("/dashboard/instructor/earnings") ? "page" : undefined}><LearningIcon name="earnings" /><span>Earnings</span></Link>{showSubscriptionPlans && <Link data-tooltip="Subscriptions" onClick={onNavigate} href="/dashboard/instructor/subscriptions" aria-current={isCurrent("/dashboard/instructor/subscriptions") ? "page" : undefined}><LearningIcon name="earnings" /><span>Subscriptions</span></Link>}<Link data-tooltip="Payout profile" onClick={onNavigate} href="/dashboard/instructor/payout-profile" aria-current={isCurrent("/dashboard/instructor/payout-profile") ? "page" : undefined}><LearningIcon name="payout" /><span>Payout profile</span></Link><Link data-tooltip={t("nav.createCourse")} onClick={onNavigate} href="/dashboard/instructor/courses/new" aria-current={isCurrent("/dashboard/instructor/courses/new") ? "page" : undefined}><LearningIcon name="add-course" /><span>{t("nav.createCourse")}</span></Link></section>}
    {isAdmin && <section><p className="eyebrow">Admin Reviews</p><Link data-tooltip={t("nav.instructorReviews")} onClick={onNavigate} href="/dashboard/admin/instructors" aria-current={isCurrent("/dashboard/admin/instructors") ? "page" : undefined}><LearningIcon name="instructor-review" /><span>{t("nav.instructorReviews")}</span></Link><Link data-tooltip={t("nav.courseReviews")} onClick={onNavigate} href="/dashboard/admin/courses" aria-current={isCurrent("/dashboard/admin/courses") ? "page" : undefined}><LearningIcon name="course-review" /><span>{t("nav.courseReviews")}</span></Link><Link data-tooltip="Provider verification" onClick={onNavigate} href="/dashboard/admin/providers" aria-current={isCurrent("/dashboard/admin/providers") ? "page" : undefined}><LearningIcon name="provider-verification" /><span>Provider verification</span></Link><Link data-tooltip={t("nav.paymentOperations")} onClick={onNavigate} href="/dashboard/admin/payments" aria-current={isCurrent("/dashboard/admin/payments") ? "page" : undefined}><LearningIcon name="payment-operations" /><span>{t("nav.paymentOperations")}</span></Link><Link data-tooltip="Commercial earnings" onClick={onNavigate} href="/dashboard/admin/commercial" aria-current={isCurrent("/dashboard/admin/commercial") ? "page" : undefined}><LearningIcon name="earnings" /><span>Commercial earnings</span></Link><Link data-tooltip="Company seller evidence" onClick={onNavigate} href="/dashboard/admin/company-commercial" aria-current={isCurrent("/dashboard/admin/company-commercial") ? "page" : undefined}><LearningIcon name="company" /><span>Company seller evidence</span></Link><Link data-tooltip="Promotions and coupons" onClick={onNavigate} href="/dashboard/admin/promotions" aria-current={isCurrent("/dashboard/admin/promotions") ? "page" : undefined}><LearningIcon name="tag" /><span>Promotions and coupons</span></Link><Link data-tooltip="Enterprise contracts" onClick={onNavigate} href="/dashboard/admin/enterprise-contracts" aria-current={isCurrent("/dashboard/admin/enterprise-contracts") ? "page" : undefined}><LearningIcon name="company" /><span>Enterprise contracts</span></Link><Link data-tooltip="Support inbox" onClick={onNavigate} href="/dashboard/admin/support" aria-current={isCurrent("/dashboard/admin/support") ? "page" : undefined}><LearningIcon name="mail" /><span>Support inbox</span></Link><Link data-tooltip="Email Center" onClick={onNavigate} href="/dashboard/admin/emails" aria-current={isCurrent("/dashboard/admin/emails") ? "page" : undefined}><LearningIcon name="mail" /><span>Email Center</span></Link></section>}
  </nav>;
}

function MobileWorkspaceLinks({ isAdmin, isInstructor, isCompany, showSubscriptionPlans, pathname, onNavigate }: WorkspaceAccess & { pathname: string; onNavigate: () => void }) {
  const { t } = useLanguage();
  return <div className="mobile-dashboard-workspaces">
    <section><p className="eyebrow">Learning</p>{navigation.filter((item) => item.href !== "/dashboard" && item.href !== "/dashboard/my-learning" && item.href !== "/dashboard/explore" && (item.href !== "/dashboard/company" || isCompany)).map((item) => item.external ? <a onClick={onNavigate} href={item.href} target="_blank" rel="noreferrer" key={item.href}><LearningIcon name={item.icon} />{t(item.labelKey)}<span className="sr-only"> (opens Growvelt Jobs in a new tab)</span></a> : <Link aria-current={isDashboardNavigationCurrent(pathname, item.href) ? "page" : undefined} onClick={onNavigate} href={item.href} key={item.href}><LearningIcon name={item.icon} />{t(item.labelKey)}</Link>)}</section>
    {isInstructor && <section><p className="eyebrow">Instructor workspace</p>{[{href:"/dashboard/instructor/courses",label:t("nav.courses"),icon:"courses" as const},{href:"/dashboard/instructor/courses/new",label:t("nav.createCourse"),icon:"add-course" as const},{href:"/dashboard/instructor/earnings",label:"Earnings",icon:"earnings" as const}].map(item=><Link onClick={onNavigate} aria-current={isDashboardNavigationCurrent(pathname,item.href)?"page":undefined} href={item.href} key={item.href}><LearningIcon name={item.icon}/>{item.label}</Link>)}<Link aria-current={isDashboardNavigationCurrent(pathname, "/dashboard/instructor") ? "page" : undefined} onClick={onNavigate} href="/dashboard/instructor"><LearningIcon name="instructor-review" />{t("nav.instructor")}</Link><Link aria-current={isDashboardNavigationCurrent(pathname, "/dashboard/instructor/organizations") ? "page" : undefined} onClick={onNavigate} href="/dashboard/instructor/organizations"><LearningIcon name="organization" />Organizations</Link><Link aria-current={isDashboardNavigationCurrent(pathname, "/dashboard/instructor/payout-profile") ? "page" : undefined} onClick={onNavigate} href="/dashboard/instructor/payout-profile"><LearningIcon name="payout" />Payout profile</Link>{showSubscriptionPlans && <Link aria-current={isDashboardNavigationCurrent(pathname, "/dashboard/instructor/subscriptions") ? "page" : undefined} onClick={onNavigate} href="/dashboard/instructor/subscriptions"><LearningIcon name="earnings" />Subscriptions</Link>}</section>}
    {isAdmin && <section><p className="eyebrow">Admin Reviews</p><Link aria-current={isDashboardNavigationCurrent(pathname, "/dashboard/admin/instructors") ? "page" : undefined} onClick={onNavigate} href="/dashboard/admin/instructors"><LearningIcon name="instructor-review" />Instructor reviews</Link><Link aria-current={isDashboardNavigationCurrent(pathname, "/dashboard/admin/courses") ? "page" : undefined} onClick={onNavigate} href="/dashboard/admin/courses"><LearningIcon name="course-review" />Course reviews</Link><Link aria-current={isDashboardNavigationCurrent(pathname, "/dashboard/admin/providers") ? "page" : undefined} onClick={onNavigate} href="/dashboard/admin/providers"><LearningIcon name="provider-verification" />Provider verification</Link><Link aria-current={isDashboardNavigationCurrent(pathname, "/dashboard/admin/payments") ? "page" : undefined} onClick={onNavigate} href="/dashboard/admin/payments"><LearningIcon name="payment-operations" />Payment operations</Link><Link aria-current={isDashboardNavigationCurrent(pathname, "/dashboard/admin/commercial") ? "page" : undefined} onClick={onNavigate} href="/dashboard/admin/commercial"><LearningIcon name="earnings" />Commercial earnings</Link><Link aria-current={isDashboardNavigationCurrent(pathname, "/dashboard/admin/company-commercial") ? "page" : undefined} onClick={onNavigate} href="/dashboard/admin/company-commercial"><LearningIcon name="company" />Company seller evidence</Link><Link aria-current={isDashboardNavigationCurrent(pathname, "/dashboard/admin/promotions") ? "page" : undefined} onClick={onNavigate} href="/dashboard/admin/promotions"><LearningIcon name="tag" />Promotions and coupons</Link><Link aria-current={isDashboardNavigationCurrent(pathname, "/dashboard/admin/enterprise-contracts") ? "page" : undefined} onClick={onNavigate} href="/dashboard/admin/enterprise-contracts"><LearningIcon name="company" />Enterprise contracts</Link><Link aria-current={isDashboardNavigationCurrent(pathname, "/dashboard/admin/support") ? "page" : undefined} onClick={onNavigate} href="/dashboard/admin/support"><LearningIcon name="mail" />Support inbox</Link><Link aria-current={isDashboardNavigationCurrent(pathname, "/dashboard/admin/emails") ? "page" : undefined} onClick={onNavigate} href="/dashboard/admin/emails"><LearningIcon name="mail" />Email Center</Link></section>}
  </div>;
}

function LanguageMenu({ open, onToggle, onSelect, menuRef }: { open: boolean; onToggle: () => void; onSelect: () => void; menuRef: React.RefObject<HTMLDivElement | null> }) {
  const { locale, setLocale, t } = useLanguage();
  const selectedLanguage = languageOptions.find((language) => language.code === locale) ?? languageOptions[0];
  return <div className="dashboard-language" ref={menuRef} data-shell-popover>
    <span>{t("language.label")}</span>
    <button type="button" aria-expanded={open} aria-haspopup="listbox" onClick={onToggle}>{selectedLanguage.label}<LearningIcon name="chevron" size={16} /></button>
    {open && <div className="dashboard-language-options" role="listbox" aria-label={t("language.label")}>{languageOptions.map((language) => <button className={locale === language.code ? "is-selected" : ""} type="button" role="option" aria-selected={locale === language.code} onClick={() => { setLocale(language.code); onSelect(); }} key={language.code}>{language.label}</button>)}<small>{t("language.browserRegion")}</small></div>}
  </div>;
}

function AccountMenu({ userEmail, displayName, avatarUrl, open, onToggle, onNavigate, menuRef }: { userEmail: string; displayName: string | null; avatarUrl: string | null; open: boolean; onToggle: () => void; onNavigate: () => void; menuRef: React.RefObject<HTMLDivElement | null> }) {
  const { t } = useLanguage();
  const initial = (displayName || userEmail).trim().charAt(0).toUpperCase() || "G";
  return <div className={open ? "dashboard-account-menu is-open" : "dashboard-account-menu"} ref={menuRef} data-shell-popover>
    <button className="dashboard-account-trigger" type="button" aria-label="Open account menu" aria-expanded={open} onClick={onToggle}><span className="dashboard-avatar" aria-hidden="true">{avatarUrl ? <img src={avatarUrl} alt="" /> : initial}</span><span className="account-chevron" aria-hidden="true"><LearningIcon name="chevron" size={16} /></span></button>
    {open && <div className="dashboard-account-popover"><p>Signed in as</p><strong>{userEmail}</strong><nav aria-label="Account"><Link onClick={onNavigate} href="/dashboard/profile"><LearningIcon name="profile" size={17} />{t("nav.profile")}</Link><Link onClick={onNavigate} href="/dashboard/settings"><LearningIcon name="settings" size={17} />{t("nav.settings")}</Link><Link onClick={onNavigate} href="/dashboard/support"><LearningIcon name="mail" size={17} />Learning support</Link></nav><ThemeControl /><SignOutButton /></div>}
  </div>;
}

export function LearningShellNavigation({ children, initialSidebarCollapsed, isInstructor, isAdmin, isCompany, showSubscriptionPlans, userEmail, displayName, avatarUrl }: { children: React.ReactNode; initialSidebarCollapsed: boolean; userEmail: string; displayName: string | null; avatarUrl: string | null } & WorkspaceAccess) {
  const { locale, setLocale, t } = useLanguage();
  const pathname = internalLearningPath(usePathname());
  const [collapsed, setCollapsed] = useState(initialSidebarCollapsed);
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const languageRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const closeDrawer = useCallback(() => setOpenPanel(null), []);
  useDashboardDrawer(openPanel === "mobile", drawerRef, closeDrawer);
  const isActive = (href: string) => isDashboardNavigationCurrent(pathname, href);
  const bottomNavigation = isInstructor ? mobileInstructorNavigation : isCompany ? [...mobileNavigation.slice(0, 4), mobileCompanyNavigation] : mobileNavigation;
  const isBottomActive = isActive;

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      const target = event.target as Node;
      const activeRef = openPanel === "language" ? languageRef : openPanel === "notifications" ? notificationsRef : openPanel === "account" ? accountRef : openPanel === "mobile" ? mobileRef : null;
      if (activeRef?.current && !activeRef.current.contains(target)) setOpenPanel(null);
    }
    function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") setOpenPanel(null); }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeOnOutsideClick); document.removeEventListener("keydown", closeOnEscape); };
  }, [openPanel]);

  const togglePanel = (panel: Exclude<OpenPanel, null>) => setOpenPanel((current) => current === panel ? null : panel);

  return <div className={`${styles.shell} ${collapsed ? "app-shell is-sidebar-collapsed" : "app-shell"}`}>
    <SkipLink />
    <aside className="learning-sidebar">
      <SidebarBrandControls collapsed={collapsed} onToggle={() => setCollapsed((current) => { const next = !current; document.cookie = `${sidebarPreferenceKey}=${next}; path=/; max-age=31536000; samesite=lax`; return next; })} />
      <LanguageMenu open={openPanel === "language"} onToggle={() => togglePanel("language")} onSelect={closeDrawer} menuRef={languageRef} />
      <nav aria-label="Learning navigation">{navigation.map((item) => { const active = !item.external && isActive(item.href); const label = t(item.labelKey); return item.external ? <a data-tooltip={label} href={item.href} target="_blank" rel="noreferrer" key={item.labelKey}><LearningIcon name={item.icon} /><span>{label}</span><span className="sr-only"> (opens Growvelt Jobs in a new tab)</span></a> : <Link className={active ? "active" : ""} data-tooltip={label} aria-current={active ? "page" : undefined} href={item.href} key={item.labelKey}><LearningIcon name={item.icon} /><span>{label}</span></Link>; })}</nav>
      <WorkspaceLinks isInstructor={isInstructor} isAdmin={isAdmin} isCompany={isCompany} showSubscriptionPlans={showSubscriptionPlans} pathname={pathname} />
      <div className="sidebar-bottom"><p className="eyebrow">Growvelt Learning</p><p>Learn, teach, and grow from one account.</p><Link href="/teach/apply">{t("nav.teach")}</Link></div>
    </aside>
    <div className="shell-content">
      <header className={openPanel === "mobile" ? `app-header ${styles.drawerHeader}` : "app-header"}><LearningMark href="/dashboard" /><div className="header-tools">
        <div className="mobile-dashboard-control" ref={mobileRef} data-shell-popover>
          <button className="mobile-dashboard-menu-button" type="button" aria-label="Open dashboard menu" aria-haspopup="dialog" aria-controls={openPanel === "mobile" ? "mobile-dashboard-drawer" : undefined} aria-expanded={openPanel === "mobile"} onClick={() => togglePanel("mobile")}><LearningIcon name="menu" /></button>
          <button className="mobile-dashboard-account-button" type="button" aria-label="Open account and dashboard menu" aria-haspopup="dialog" aria-controls={openPanel === "mobile" ? "mobile-dashboard-drawer" : undefined} aria-expanded={openPanel === "mobile"} onClick={() => togglePanel("mobile")}><span className="dashboard-avatar" aria-hidden="true">{avatarUrl ? <img src={avatarUrl} alt="" /> : (displayName || userEmail).trim().charAt(0).toUpperCase() || "G"}</span></button>
          {openPanel === "mobile" && <><button className="mobile-dashboard-backdrop" type="button" aria-label="Close dashboard menu" onClick={() => setOpenPanel(null)} /><aside ref={drawerRef} id="mobile-dashboard-drawer" className="mobile-dashboard-menu" role="dialog" aria-modal="true" aria-label="Mobile dashboard menu" tabIndex={-1}>
            <header><LearningMark href="/dashboard" /><button data-drawer-close type="button" aria-label="Close dashboard menu" onClick={() => setOpenPanel(null)}><LearningIcon name="close" /></button></header>
            <div className={styles.drawerBody}><div className="mobile-dashboard-identity"><span className="dashboard-avatar" aria-hidden="true">{avatarUrl ? <img src={avatarUrl} alt="" /> : (displayName || userEmail).trim().charAt(0).toUpperCase() || "G"}</span><div><small>Signed in as</small><strong>{userEmail}</strong></div></div>
            <div className="mobile-dashboard-language"><label htmlFor="mobile-dashboard-language-select">{t("language.label")}</label><select id="mobile-dashboard-language-select" value={locale} onChange={(event) => setLocale(event.target.value as typeof locale)}>{languageOptions.map((language) => <option value={language.code} key={language.code}>{language.label}</option>)}</select><small>{t("language.browserRegion")}</small></div>
            <nav aria-label="Mobile dashboard links"><Link onClick={() => setOpenPanel(null)} href="/dashboard/profile"><LearningIcon name="profile" />{t("nav.profile")}</Link><Link onClick={() => setOpenPanel(null)} href="/dashboard/settings"><LearningIcon name="settings" />{t("nav.settings")}</Link><Link onClick={() => setOpenPanel(null)} href="/dashboard/support"><LearningIcon name="mail" />Learning support</Link></nav>
            <MobileWorkspaceLinks isAdmin={isAdmin} isInstructor={isInstructor} isCompany={isCompany} showSubscriptionPlans={showSubscriptionPlans} pathname={pathname} onNavigate={closeDrawer} />
            <ThemeControl /></div><footer className={styles.drawerFooter}><SignOutButton /></footer>
          </aside></>}
        </div>
        <div className="dashboard-notifications" ref={notificationsRef} data-shell-popover>
          <button type="button" aria-label="Learning notifications" aria-expanded={openPanel === "notifications"} onClick={() => togglePanel("notifications")}><LearningIcon name="bell" size={23} /></button>
          {openPanel === "notifications" && <LearningNotifications onClose={() => setOpenPanel(null)} />}
        </div>
        <AccountMenu userEmail={userEmail} displayName={displayName} avatarUrl={avatarUrl} open={openPanel === "account"} onToggle={() => togglePanel("account")} onNavigate={closeDrawer} menuRef={accountRef} />
      </div></header>
      <main id="main-content" className="dashboard-main">{children}</main>
    </div>
    <nav className="mobile-nav" hidden={openPanel === "mobile"} aria-label="Learning navigation">{bottomNavigation.map((item) => { const active = !("external" in item && item.external) && isBottomActive(item.href); const label = "mobileLabel" in item ? item.mobileLabel : "label" in item ? item.label : t(("mobileLabelKey" in item ? item.mobileLabelKey : item.labelKey) ?? item.labelKey); return "external" in item && item.external ? <a href={item.href} target="_blank" rel="noreferrer" key={item.href}><LearningIcon name={item.icon} size={18} /><small>{label}</small><span className="sr-only"> (opens Growvelt Jobs in a new tab)</span></a> : <Link className={active ? "active" : ""} aria-current={active ? "page" : undefined} href={item.href} key={item.href}><LearningIcon name={item.icon} size={18} /><small>{label}</small></Link>; })}</nav>
  </div>;
}
