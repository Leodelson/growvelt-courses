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
];
const mobileNavigation = navigation.filter((item) => item.href !== "/dashboard/saved-courses");

type WorkspaceAccess = { isInstructor: boolean; isAdmin: boolean };
type OpenPanel = "language" | "notifications" | "account" | "mobile" | null;
const sidebarPreferenceKey = "growvelt-learning-sidebar-collapsed";

function WorkspaceLinks({ isInstructor, isAdmin, pathname, onNavigate }: WorkspaceAccess & { pathname: string; onNavigate?: () => void }) {
  const { t } = useLanguage();
  if (!isInstructor && !isAdmin) return null;
  const isCurrent = (href: string) => {
    if (href === "/dashboard/instructor") return pathname === href;
    if (href === "/dashboard/instructor/courses/new") return pathname === href;
    if (href === "/dashboard/instructor/courses") return pathname === href || /^\/dashboard\/instructor\/courses\/\d+(?:\/curriculum)?$/.test(pathname);
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return <nav className="workspace-links" aria-label="Available workspaces">
    {isInstructor && <section><p className="eyebrow">{t("nav.instructor")}</p><Link data-tooltip={t("nav.instructor")} onClick={onNavigate} href="/dashboard/instructor" aria-current={isCurrent("/dashboard/instructor") ? "page" : undefined}><LearningIcon name="instructor-review" /><span>{t("nav.instructor")}</span></Link><Link data-tooltip={t("nav.courses")} onClick={onNavigate} href="/dashboard/instructor/courses" aria-current={isCurrent("/dashboard/instructor/courses") ? "page" : undefined}><LearningIcon name="courses" /><span>{t("nav.courses")}</span></Link><Link data-tooltip={t("nav.createCourse")} onClick={onNavigate} href="/dashboard/instructor/courses/new" aria-current={isCurrent("/dashboard/instructor/courses/new") ? "page" : undefined}><LearningIcon name="add-course" /><span>{t("nav.createCourse")}</span></Link></section>}
    {isAdmin && <section><p className="eyebrow">Admin Reviews</p><Link data-tooltip={t("nav.instructorReviews")} onClick={onNavigate} href="/dashboard/admin/instructors" aria-current={isCurrent("/dashboard/admin/instructors") ? "page" : undefined}><LearningIcon name="instructor-review" /><span>{t("nav.instructorReviews")}</span></Link><Link data-tooltip={t("nav.courseReviews")} onClick={onNavigate} href="/dashboard/admin/courses" aria-current={isCurrent("/dashboard/admin/courses") ? "page" : undefined}><LearningIcon name="course-review" /><span>{t("nav.courseReviews")}</span></Link></section>}
  </nav>;
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

export function LearningShellNavigation({ children, initialSidebarCollapsed, isInstructor, isAdmin, userEmail, displayName, avatarUrl }: { children: React.ReactNode; initialSidebarCollapsed: boolean; userEmail: string; displayName: string | null; avatarUrl: string | null } & WorkspaceAccess) {
  const { locale, setLocale, t } = useLanguage();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialSidebarCollapsed);
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const languageRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);
  const isActive = (href: string) => pathname === href;

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
      <WorkspaceLinks isInstructor={isInstructor} isAdmin={isAdmin} pathname={pathname} />
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
            <div className="mobile-dashboard-language"><strong>{t("language.label")}</strong><div className="mobile-language-options">{languageOptions.map((language) => <button className={locale === language.code ? "is-selected" : ""} type="button" aria-pressed={locale === language.code} onClick={() => setLocale(language.code)} key={language.code}>{language.shortLabel}</button>)}</div><small>{t("language.browserRegion")}</small></div>
            <nav aria-label="Mobile dashboard links"><Link onClick={() => setOpenPanel(null)} href="/dashboard/profile"><LearningIcon name="profile" />{t("nav.profile")}</Link><Link onClick={() => setOpenPanel(null)} href="/dashboard/saved-courses"><LearningIcon name="heart" />{t("nav.saved")}</Link><Link onClick={() => setOpenPanel(null)} href="/dashboard/settings"><LearningIcon name="settings" />{t("nav.settings")}</Link></nav>
            <WorkspaceLinks isInstructor={isInstructor} isAdmin={isAdmin} pathname={pathname} onNavigate={() => setOpenPanel(null)} />
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
    <nav className="mobile-nav" aria-label="Learning navigation">{mobileNavigation.map((item) => { const active = !item.external && isActive(item.href); const label = t(item.mobileLabelKey ?? item.labelKey); return item.external ? <a href={item.href} target="_blank" rel="noreferrer" key={item.labelKey}><LearningIcon name={item.icon} size={18} /><small>{label}</small><span className="sr-only"> (opens Growvelt Jobs in a new tab)</span></a> : <Link className={active ? "active" : ""} aria-current={active ? "page" : undefined} href={item.href} key={item.labelKey}><LearningIcon name={item.icon} size={18} /><small>{label}</small></Link>; })}</nav>
  </div>;
}
