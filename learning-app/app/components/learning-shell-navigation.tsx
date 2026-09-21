"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SignOutButton } from "@/app/components/auth/sign-out-button";
import { WelcomeEmailTrigger } from "@/app/components/auth/welcome-email-trigger";
import { LearningIcon } from "@/app/components/learning-icon";
import { LearningMark } from "@/app/components/learning-mark";
import { ThemeControl } from "@/app/components/theme-control";
import { useLanguage } from "@/app/components/language-provider";
import { languageOptions } from "@/app/lib/i18n";
import { SkipLink } from "@/app/components/ui/skip-link";

const navigation = [
  { href: "/dashboard", labelKey: "nav.home" as const, icon: "home" as const },
  { href: "/dashboard/my-learning", labelKey: "nav.learning" as const, icon: "learning" as const },
  { href: "/dashboard/explore", labelKey: "nav.explore" as const, mobileLabelKey: "nav.exploreMobile" as const, icon: "explore" as const },
  { href: "https://www.growvelt.com", labelKey: "nav.jobs" as const, icon: "jobs" as const, external: true },
  { href: "/dashboard/saved-courses", labelKey: "nav.saved" as const, icon: "heart" as const },
  { href: "/dashboard/certificates", labelKey: "nav.certificates" as const, icon: "certificate" as const },
  { href: "/dashboard/company", labelKey: "nav.company" as const, icon: "organization" as const },
];
const mobileNavigation = navigation.filter((item) => item.href !== "/dashboard/saved-courses" && item.href !== "/dashboard/company");
const mobileInstructorNavigation = [
  { href: "/dashboard", labelKey: "nav.home" as const, icon: "home" as const },
  { href: "/dashboard/instructor/courses", label: "My courses", mobileLabel: "My Courses", icon: "courses" as const },
  { href: "/dashboard/instructor/courses/new", label: "Create course", mobileLabel: "Create", icon: "add-course" as const },
  { href: "/dashboard/instructor/organizations", label: "Organizations", mobileLabel: "Org", icon: "organization" as const },
  { href: "/dashboard/instructor/earnings", label: "Earnings", icon: "earnings" as const },
];
const mobileCompanyNavigation = { href: "/dashboard/company", label: "Company", icon: "company" as const };

type WorkspaceAccess = { isInstructor: boolean; isAdmin: boolean; isCompany: boolean };
type OpenPanel = "language" | "notifications" | "account" | "mobile" | null;
const sidebarPreferenceKey = "growvelt-learning-sidebar-collapsed";

function WorkspaceLinks({ isInstructor, isAdmin, isCompany, pathname, onNavigate }: WorkspaceAccess & { pathname: string; onNavigate?: () => void }) {
  const { t } = useLanguage();
  if (!isInstructor && !isAdmin && !isCompany) return null;
  const isCurrent = (href: string) => {
    if (href === "/dashboard/instructor") return pathname === href;
    if (href === "/dashboard/instructor/courses/new") return pathname === href;
    if (href === "/dashboard/instructor/courses") return pathname === href || /^\/dashboard\/instructor\/courses\/\d+(?:\/curriculum)?$/.test(pathname);
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return <nav className="workspace-links" aria-label="Available workspaces">
    {isInstructor && <section><p className="eyebrow">{t("nav.instructor")}</p><Link data-tooltip={t("nav.instructor")} onClick={onNavigate} href="/dashboard/instructor" aria-current={isCurrent("/dashboard/instructor") ? "page" : undefined}><LearningIcon name="instructor-review" /><span>{t("nav.instructor")}</span></Link><Link data-tooltip={t("nav.courses")} onClick={onNavigate} href="/dashboard/instructor/courses" aria-current={isCurrent("/dashboard/instructor/courses") ? "page" : undefined}><LearningIcon name="courses" /><span>{t("nav.courses")}</span></Link><Link data-tooltip="Organizations" onClick={onNavigate} href="/dashboard/instructor/organizations" aria-current={isCurrent("/dashboard/instructor/organizations") ? "page" : undefined}><LearningIcon name="organization" /><span>Organizations</span></Link><Link data-tooltip="Earnings" onClick={onNavigate} href="/dashboard/instructor/earnings" aria-current={isCurrent("/dashboard/instructor/earnings") ? "page" : undefined}><LearningIcon name="earnings" /><span>Earnings</span></Link><Link data-tooltip="Payout profile" onClick={onNavigate} href="/dashboard/instructor/payout-profile" aria-current={isCurrent("/dashboard/instructor/payout-profile") ? "page" : undefined}><LearningIcon name="earnings" /><span>Payout profile</span></Link><Link data-tooltip={t("nav.createCourse")} onClick={onNavigate} href="/dashboard/instructor/courses/new" aria-current={isCurrent("/dashboard/instructor/courses/new") ? "page" : undefined}><LearningIcon name="add-course" /><span>{t("nav.createCourse")}</span></Link></section>}
    {isCompany && <section><p className="eyebrow">Company learning</p><Link data-tooltip="Company learning" onClick={onNavigate} href="/dashboard/company" aria-current={isCurrent("/dashboard/company") ? "page" : undefined}><LearningIcon name="organization" /><span>Company learning</span></Link></section>}
    {isAdmin && <section><p className="eyebrow">Admin Reviews</p><Link data-tooltip={t("nav.instructorReviews")} onClick={onNavigate} href="/dashboard/admin/instructors" aria-current={isCurrent("/dashboard/admin/instructors") ? "page" : undefined}><LearningIcon name="instructor-review" /><span>{t("nav.instructorReviews")}</span></Link><Link data-tooltip={t("nav.courseReviews")} onClick={onNavigate} href="/dashboard/admin/courses" aria-current={isCurrent("/dashboard/admin/courses") ? "page" : undefined}><LearningIcon name="course-review" /><span>{t("nav.courseReviews")}</span></Link><Link data-tooltip="Provider verification" onClick={onNavigate} href="/dashboard/admin/providers" aria-current={isCurrent("/dashboard/admin/providers") ? "page" : undefined}><LearningIcon name="organization" /><span>Provider verification</span></Link><Link data-tooltip={t("nav.paymentOperations")} onClick={onNavigate} href="/dashboard/admin/payments" aria-current={isCurrent("/dashboard/admin/payments") ? "page" : undefined}><LearningIcon name="payment-operations" /><span>{t("nav.paymentOperations")}</span></Link><Link data-tooltip="Commercial earnings" onClick={onNavigate} href="/dashboard/admin/commercial" aria-current={isCurrent("/dashboard/admin/commercial") ? "page" : undefined}><LearningIcon name="earnings" /><span>Commercial earnings</span></Link></section>}
  </nav>;
}

function MobileWorkspaceLinks({ isAdmin, isInstructor, isCompany, onNavigate }: Pick<WorkspaceAccess, "isAdmin" | "isInstructor" | "isCompany"> & { onNavigate: () => void }) {
  const { t } = useLanguage();
  return <div className="mobile-dashboard-workspaces">
    <section><p className="eyebrow">Learning</p>{navigation.filter((item) => item.href !== "/dashboard/saved-courses" && (item.href !== "/dashboard/company" || isCompany)).map((item) => item.external ? <a onClick={onNavigate} href={item.href} target="_blank" rel="noreferrer" key={item.href}><LearningIcon name={item.icon} />{t(item.labelKey)}</a> : <Link onClick={onNavigate} href={item.href} key={item.href}><LearningIcon name={item.icon} />{t(item.labelKey)}</Link>)}</section>
    {isInstructor && <section><p className="eyebrow">Instructor workspace</p><Link onClick={onNavigate} href="/dashboard/instructor"><LearningIcon name="instructor-review" />{t("nav.instructor")}</Link><Link onClick={onNavigate} href="/dashboard/instructor/courses"><LearningIcon name="courses" />{t("nav.courses")}</Link><Link onClick={onNavigate} href="/dashboard/instructor/courses/new"><LearningIcon name="add-course" />{t("nav.createCourse")}</Link><Link onClick={onNavigate} href="/dashboard/instructor/organizations"><LearningIcon name="organization" />Organizations</Link><Link onClick={onNavigate} href="/dashboard/instructor/earnings"><LearningIcon name="earnings" />Earnings</Link><Link onClick={onNavigate} href="/dashboard/instructor/payout-profile"><LearningIcon name="earnings" />Payout profile</Link></section>}
    {isAdmin && <section><p className="eyebrow">Admin Reviews</p><Link onClick={onNavigate} href="/dashboard/admin/instructors"><LearningIcon name="instructor-review" />Instructor reviews</Link><Link onClick={onNavigate} href="/dashboard/admin/courses"><LearningIcon name="course-review" />Course reviews</Link><Link onClick={onNavigate} href="/dashboard/admin/providers"><LearningIcon name="organization" />Provider verification</Link><Link onClick={onNavigate} href="/dashboard/admin/payments"><LearningIcon name="payment-operations" />Payment operations</Link><Link onClick={onNavigate} href="/dashboard/admin/commercial"><LearningIcon name="earnings" />Commercial earnings</Link></section>}
  </div>;
}

function LanguageMenu({ open, onToggle, menuRef }: { open: boolean; onToggle: () => void; menuRef: React.RefObject<HTMLDivElement | null> }) {
  const { locale, setLocale, t } = useLanguage();
  const selectedLanguage = languageOptions.find((language) => language.code === locale) ?? languageOptions[0];
  return <div className="dashboard-language" ref={menuRef} data-shell-popover>
    <span>{t("language.label")}</span>
    <button type="button" aria-expanded={open} aria-haspopup="listbox" onClick={onToggle}>{selectedLanguage.label}<LearningIcon name="chevron" size={16} /></button>
    {open && <div className="dashboard-language-options" role="listbox" aria-label={t("language.label")}>{languageOptions.map((language) => <button className={locale === language.code ? "is-selected" : ""} type="button" role="option" aria-selected={locale === language.code} onClick={() => setLocale(language.code)} key={language.code}>{language.label}</button>)}<small>{t("language.browserRegion")}</small></div>}
  </div>;
}

function AccountMenu({ userEmail, displayName, avatarUrl, open, onToggle, menuRef }: { userEmail: string; displayName: string | null; avatarUrl: string | null; open: boolean; onToggle: () => void; menuRef: React.RefObject<HTMLDivElement | null> }) {
  const initial = (displayName || userEmail).trim().charAt(0).toUpperCase() || "G";
  return <div className={open ? "dashboard-account-menu is-open" : "dashboard-account-menu"} ref={menuRef} data-shell-popover>
    <button className="dashboard-account-trigger" type="button" aria-label="Open account menu" aria-expanded={open} onClick={onToggle}><span className="dashboard-avatar" aria-hidden="true">{avatarUrl ? <img src={avatarUrl} alt="" /> : initial}</span><span className="account-chevron" aria-hidden="true"><LearningIcon name="chevron" size={16} /></span></button>
    {open && <div className="dashboard-account-popover"><p>Signed in as</p><strong>{userEmail}</strong><nav aria-label="Account"><Link href="/dashboard/profile"><LearningIcon name="profile" size={17} />Profile</Link><Link href="/dashboard/settings"><LearningIcon name="settings" size={17} />Settings</Link></nav><ThemeControl /><SignOutButton /></div>}
  </div>;
}

export function LearningShellNavigation({ children, initialSidebarCollapsed, isInstructor, isAdmin, isCompany, userEmail, displayName, avatarUrl }: { children: React.ReactNode; initialSidebarCollapsed: boolean; userEmail: string; displayName: string | null; avatarUrl: string | null } & WorkspaceAccess) {
  const { locale, setLocale, t } = useLanguage();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialSidebarCollapsed);
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const languageRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);
  const isActive = (href: string) => pathname === href;
  const bottomNavigation = isInstructor ? mobileInstructorNavigation : isCompany ? [...mobileNavigation.slice(0, 4), mobileCompanyNavigation] : mobileNavigation;
  const isBottomActive = (href: string) => href === "/dashboard/instructor/courses" ? pathname === href || /^\/dashboard\/instructor\/courses\/\d+/.test(pathname) : href === "/dashboard/instructor/organizations" ? pathname.startsWith(href) : isActive(href);

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

  return <div className={collapsed ? "app-shell is-sidebar-collapsed" : "app-shell"}>
    <WelcomeEmailTrigger />
    <SkipLink />
    <aside className="learning-sidebar">
      <button className="sidebar-collapse-button" type="button" aria-label={collapsed ? "Expand dashboard navigation" : "Collapse dashboard navigation"} aria-expanded={!collapsed} onClick={() => setCollapsed((current) => { const next = !current; document.cookie = `${sidebarPreferenceKey}=${next}; path=/; max-age=31536000; samesite=lax`; return next; })}><LearningIcon name="collapse" /></button>
      <LanguageMenu open={openPanel === "language"} onToggle={() => togglePanel("language")} menuRef={languageRef} />
      <nav aria-label="Learning navigation">{navigation.map((item) => { const active = !item.external && isActive(item.href); const label = t(item.labelKey); return item.external ? <a data-tooltip={label} href={item.href} target="_blank" rel="noreferrer" key={item.labelKey}><LearningIcon name={item.icon} /><span>{label}</span><span className="sr-only"> (opens Growvelt Jobs in a new tab)</span></a> : <Link className={active ? "active" : ""} data-tooltip={label} aria-current={active ? "page" : undefined} href={item.href} key={item.labelKey}><LearningIcon name={item.icon} /><span>{label}</span></Link>; })}</nav>
      <WorkspaceLinks isInstructor={isInstructor} isAdmin={isAdmin} isCompany={isCompany} pathname={pathname} />
      <div className="sidebar-bottom"><p className="eyebrow">Growvelt Learning</p><p>Learn, teach, and grow from one account.</p><Link href="/teach/apply">{t("nav.teach")}</Link></div>
    </aside>
    <div className="shell-content">
      <header className="app-header"><LearningMark href="/dashboard" /><div className="header-tools">
        <div className="mobile-dashboard-control" ref={mobileRef} data-shell-popover>
          <button className="mobile-dashboard-menu-button" type="button" aria-label="Open dashboard menu" aria-expanded={openPanel === "mobile"} onClick={() => togglePanel("mobile")}><LearningIcon name="menu" /></button>
          <button className="mobile-dashboard-account-button" type="button" aria-label="Open account and dashboard menu" aria-expanded={openPanel === "mobile"} onClick={() => togglePanel("mobile")}><span className="dashboard-avatar" aria-hidden="true">{avatarUrl ? <img src={avatarUrl} alt="" /> : (displayName || userEmail).trim().charAt(0).toUpperCase() || "G"}</span></button>
          {openPanel === "mobile" && <><button className="mobile-dashboard-backdrop" type="button" aria-label="Close dashboard menu" onClick={() => setOpenPanel(null)} /><aside className="mobile-dashboard-menu" aria-label="Mobile dashboard menu">
            <header><LearningMark href="/dashboard" /><button type="button" aria-label="Close dashboard menu" onClick={() => setOpenPanel(null)}><LearningIcon name="close" /></button></header>
            <div className="mobile-dashboard-identity"><span className="dashboard-avatar" aria-hidden="true">{avatarUrl ? <img src={avatarUrl} alt="" /> : (displayName || userEmail).trim().charAt(0).toUpperCase() || "G"}</span><div><small>Signed in as</small><strong>{userEmail}</strong></div></div>
            <div className="mobile-dashboard-language"><label htmlFor="mobile-dashboard-language-select">{t("language.label")}</label><select id="mobile-dashboard-language-select" value={locale} onChange={(event) => setLocale(event.target.value as typeof locale)}>{languageOptions.map((language) => <option value={language.code} key={language.code}>{language.label}</option>)}</select><small>{t("language.browserRegion")}</small></div>
            <nav aria-label="Mobile dashboard links"><Link onClick={() => setOpenPanel(null)} href="/dashboard/profile"><LearningIcon name="profile" />{t("nav.profile")}</Link><Link onClick={() => setOpenPanel(null)} href="/dashboard/saved-courses"><LearningIcon name="heart" />{t("nav.saved")}</Link><Link onClick={() => setOpenPanel(null)} href="/dashboard/settings"><LearningIcon name="settings" />{t("nav.settings")}</Link></nav>
            <MobileWorkspaceLinks isAdmin={isAdmin} isInstructor={isInstructor} isCompany={isCompany} onNavigate={() => setOpenPanel(null)} />
            <ThemeControl /><SignOutButton />
          </aside></>}
        </div>
        <div className="dashboard-notifications" ref={notificationsRef} data-shell-popover>
          <button type="button" aria-label="Learning notifications" aria-expanded={openPanel === "notifications"} onClick={() => togglePanel("notifications")}><LearningIcon name="bell" size={23} /></button>
          {openPanel === "notifications" && <section className="dashboard-notifications-popover" aria-label="Learning notifications">
            <header><div><p>Notifications</p><span>Learning updates</span></div><button type="button" aria-label="Close notifications" onClick={() => setOpenPanel(null)}><LearningIcon name="close" size={18} /></button></header>
            <div className="dashboard-notifications-empty"><span className="dashboard-notifications-empty-icon"><LearningIcon name="bell" size={28} /></span><h2>You&rsquo;re all caught up.</h2><p>Course, quiz, certificate, and review updates will appear here when there is something new for you.</p></div>
          </section>}
        </div>
        <AccountMenu userEmail={userEmail} displayName={displayName} avatarUrl={avatarUrl} open={openPanel === "account"} onToggle={() => togglePanel("account")} menuRef={accountRef} />
      </div></header>
      <main id="main-content" className="dashboard-main">{children}</main>
    </div>
    <nav className="mobile-nav" aria-label="Learning navigation">{bottomNavigation.map((item) => { const active = !("external" in item && item.external) && isBottomActive(item.href); const label = "mobileLabel" in item ? item.mobileLabel : "label" in item ? item.label : t(("mobileLabelKey" in item ? item.mobileLabelKey : item.labelKey) ?? item.labelKey); return "external" in item && item.external ? <a href={item.href} target="_blank" rel="noreferrer" key={item.href}><LearningIcon name={item.icon} size={18} /><small>{label}</small><span className="sr-only"> (opens Growvelt Jobs in a new tab)</span></a> : <Link className={active ? "active" : ""} aria-current={active ? "page" : undefined} href={item.href} key={item.href}><LearningIcon name={item.icon} size={18} /><small>{label}</small></Link>; })}</nav>
  </div>;
}
