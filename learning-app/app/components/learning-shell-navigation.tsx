"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SignOutButton } from "@/app/components/auth/sign-out-button";
import { LearningIcon } from "@/app/components/learning-icon";
import { LearningMark } from "@/app/components/learning-mark";
import { ThemeControl } from "@/app/components/theme-control";
import { SkipLink } from "@/app/components/ui/skip-link";

const navigation = [
  { href: "/dashboard", label: "Home", icon: "home" as const },
  { href: "/dashboard/my-learning", label: "My Learning", icon: "learning" as const },
  { href: "/dashboard/explore", label: "Explore catalog", mobileLabel: "Explore", icon: "explore" as const },
  { href: "/dashboard/certificates", label: "Certificates", icon: "certificate" as const },
];

const futureLanguages = ["English (United States)", "English (United Kingdom)", "French", "German", "Spanish", "Portuguese", "Dutch"];
type WorkspaceAccess = { isInstructor: boolean; isAdmin: boolean };
type OpenPanel = "language" | "notifications" | "account" | "mobile" | null;

function WorkspaceLinks({ isInstructor, isAdmin, pathname, onNavigate }: WorkspaceAccess & { pathname: string; onNavigate?: () => void }) {
  if (!isInstructor && !isAdmin) return null;
  const isCurrent = (href: string) => {
    if (href === "/dashboard/instructor") return pathname === href;
    if (href === "/dashboard/instructor/courses/new") return pathname === href;
    if (href === "/dashboard/instructor/courses") return pathname === href || /^\/dashboard\/instructor\/courses\/\d+(?:\/curriculum)?$/.test(pathname);
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return <nav className="workspace-links" aria-label="Available workspaces">
    {isInstructor && <section><p className="eyebrow">Instructor Workspace</p><Link onClick={onNavigate} href="/dashboard/instructor" aria-current={isCurrent("/dashboard/instructor") ? "page" : undefined}>Instructor workspace</Link><Link onClick={onNavigate} href="/dashboard/instructor/courses" aria-current={isCurrent("/dashboard/instructor/courses") ? "page" : undefined}>My Courses</Link><Link onClick={onNavigate} href="/dashboard/instructor/courses/new" aria-current={isCurrent("/dashboard/instructor/courses/new") ? "page" : undefined}>Create Course</Link></section>}
    {isAdmin && <section><p className="eyebrow">Admin Reviews</p><Link onClick={onNavigate} href="/dashboard/admin/instructors" aria-current={isCurrent("/dashboard/admin/instructors") ? "page" : undefined}>Instructor Reviews</Link><Link onClick={onNavigate} href="/dashboard/admin/courses" aria-current={isCurrent("/dashboard/admin/courses") ? "page" : undefined}>Course Reviews</Link></section>}
  </nav>;
}

function LanguageMenu({ open, onToggle, menuRef }: { open: boolean; onToggle: () => void; menuRef: React.RefObject<HTMLDivElement | null> }) {
  return <div className="dashboard-language" ref={menuRef} data-shell-popover>
    <span>Language &amp; region</span>
    <button type="button" aria-expanded={open} aria-haspopup="listbox" onClick={onToggle}>English (Global)<LearningIcon name="chevron" size={16} /></button>
    {open && <div className="dashboard-language-options" role="listbox" aria-label="Language and region"><button className="is-selected" type="button" role="option" aria-selected="true">English (Global)</button>{futureLanguages.map((language) => <button type="button" role="option" aria-selected="false" aria-disabled="true" disabled key={language}>{language}<small>Coming later</small></button>)}</div>}
  </div>;
}

function AccountMenu({ userEmail, displayName, open, onToggle, menuRef }: { userEmail: string; displayName: string | null; open: boolean; onToggle: () => void; menuRef: React.RefObject<HTMLDivElement | null> }) {
  const initial = (displayName || userEmail).trim().charAt(0).toUpperCase() || "G";
  return <div className={open ? "dashboard-account-menu is-open" : "dashboard-account-menu"} ref={menuRef} data-shell-popover>
    <button className="dashboard-account-trigger" type="button" aria-label="Open account menu" aria-expanded={open} onClick={onToggle}><span className="dashboard-avatar" aria-hidden="true">{initial}</span><span className="account-chevron" aria-hidden="true"><LearningIcon name="chevron" size={16} /></span></button>
    {open && <div className="dashboard-account-popover"><p>Signed in as</p><strong>{userEmail}</strong><nav aria-label="Account"><span className="account-future-link"><LearningIcon name="profile" size={17} />Profile <small>Coming in Profile phase</small></span><Link href="/dashboard/settings"><LearningIcon name="settings" size={17} />Settings</Link></nav><ThemeControl /><SignOutButton /></div>}
  </div>;
}

export function LearningShellNavigation({ children, isInstructor, isAdmin, userEmail, displayName }: { children: React.ReactNode; userEmail: string; displayName: string | null } & WorkspaceAccess) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
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
    <SkipLink />
    <aside className="learning-sidebar">
      <button className="sidebar-collapse-button" type="button" aria-label={collapsed ? "Expand dashboard navigation" : "Collapse dashboard navigation"} aria-expanded={!collapsed} onClick={() => setCollapsed((current) => !current)}><LearningIcon name="collapse" /></button>
      <LanguageMenu open={openPanel === "language"} onToggle={() => togglePanel("language")} menuRef={languageRef} />
      <nav aria-label="Learning navigation">{navigation.map((item) => { const active = isActive(item.href); return <Link className={active ? "active" : ""} aria-current={active ? "page" : undefined} href={item.href} key={item.label}><LearningIcon name={item.icon} /><span>{item.label}</span></Link>; })}</nav>
      <WorkspaceLinks isInstructor={isInstructor} isAdmin={isAdmin} pathname={pathname} />
      <div className="sidebar-bottom"><p className="eyebrow">Growvelt Learning</p><p>Learn, teach, and grow from one account.</p><Link href="/teach/apply">Teach on Growvelt</Link></div>
    </aside>
    <div className="shell-content">
      <header className="app-header"><LearningMark href="/dashboard" /><div className="header-tools">
        <div className="mobile-dashboard-control" ref={mobileRef} data-shell-popover>
          <button className="mobile-dashboard-menu-button" type="button" aria-label="Open dashboard menu" aria-expanded={openPanel === "mobile"} onClick={() => togglePanel("mobile")}><LearningIcon name="menu" /></button>
          <button className="mobile-dashboard-account-button" type="button" aria-label="Open account and dashboard menu" aria-expanded={openPanel === "mobile"} onClick={() => togglePanel("mobile")}><span className="dashboard-avatar" aria-hidden="true">{(displayName || userEmail).trim().charAt(0).toUpperCase() || "G"}</span></button>
          {openPanel === "mobile" && <><button className="mobile-dashboard-backdrop" type="button" aria-label="Close dashboard menu" onClick={() => setOpenPanel(null)} /><aside className="mobile-dashboard-menu" aria-label="Mobile dashboard menu">
            <header><LearningMark href="/dashboard" /><button type="button" aria-label="Close dashboard menu" onClick={() => setOpenPanel(null)}><LearningIcon name="close" /></button></header>
            <div className="mobile-dashboard-identity"><span className="dashboard-avatar" aria-hidden="true">{(displayName || userEmail).trim().charAt(0).toUpperCase() || "G"}</span><div><small>Signed in as</small><strong>{userEmail}</strong></div></div>
            <div className="mobile-dashboard-language"><strong>Language &amp; region</strong><span>English (Global)</span><small>More languages require translated Learning content.</small></div>
            <nav aria-label="Mobile dashboard links"><span className="account-future-link"><LearningIcon name="profile" />Profile <small>Coming later</small></span><Link onClick={() => setOpenPanel(null)} href="/dashboard/settings"><LearningIcon name="settings" />Settings</Link></nav>
            <WorkspaceLinks isInstructor={isInstructor} isAdmin={isAdmin} pathname={pathname} onNavigate={() => setOpenPanel(null)} />
            <ThemeControl /><SignOutButton />
          </aside></>}
        </div>
        <div className="dashboard-notifications" ref={notificationsRef} data-shell-popover><button type="button" aria-label="Learning notifications" aria-expanded={openPanel === "notifications"} onClick={() => togglePanel("notifications")}><LearningIcon name="bell" size={23} /></button>{openPanel === "notifications" && <div><strong>Learning notifications</strong><p>Notifications are not connected yet.</p></div>}</div>
        <AccountMenu userEmail={userEmail} displayName={displayName} open={openPanel === "account"} onToggle={() => togglePanel("account")} menuRef={accountRef} />
      </div></header>
      <main id="main-content" className="dashboard-main">{children}</main>
    </div>
    <nav className="mobile-nav" aria-label="Learning navigation">{navigation.map((item) => { const active = isActive(item.href); return <Link className={active ? "active" : ""} aria-current={active ? "page" : undefined} href={item.href} key={item.label}><LearningIcon name={item.icon} size={18} /><small>{item.mobileLabel ?? item.label}</small></Link>; })}</nav>
  </div>;
}
