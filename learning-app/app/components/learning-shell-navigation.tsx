"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/app/components/auth/sign-out-button";
import { LearningIcon } from "@/app/components/learning-icon";
import { LearningMark } from "@/app/components/learning-mark";
import { ThemeControl } from "@/app/components/theme-control";
import { SkipLink } from "@/app/components/ui/skip-link";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: "overview" as const },
  { href: "/dashboard#my-learning", label: "My Learning", icon: "learning" as const },
  { href: "/learn", label: "Explore catalog", mobileLabel: "Explore", icon: "explore" as const },
  { href: "/dashboard/certificates", label: "Certificates", icon: "certificate" as const },
  { href: "/settings", label: "Settings", icon: "settings" as const },
];

type WorkspaceAccess = { isInstructor: boolean; isAdmin: boolean };

function WorkspaceLinks({ isInstructor, isAdmin }: WorkspaceAccess) {
  if (!isInstructor && !isAdmin) return null;
  return <nav className="workspace-links" aria-label="Available workspaces">{isInstructor && <section><p className="eyebrow">Instructor Workspace</p><Link href="/instructor">Instructor workspace</Link><Link href="/instructor/courses">My Courses</Link></section>}{isAdmin && <section><p className="eyebrow">Admin Operations</p><Link href="/admin/instructors">Instructor Applications</Link></section>}</nav>;
}

export function LearningShellNavigation({ children, isInstructor, isAdmin }: { children: React.ReactNode } & WorkspaceAccess) {
  const pathname = usePathname();
  const isActive = (href: string) => href === "/dashboard" ? pathname === "/dashboard" : !href.includes("#") && pathname === href;
  return <div className="app-shell">
    <SkipLink />
    <aside className="learning-sidebar"><LearningMark href="/dashboard" /><nav aria-label="Learning navigation">{navigation.map((item) => { const active = isActive(item.href); return <Link className={active ? "active" : ""} aria-current={active ? "page" : undefined} href={item.href} key={item.label}><LearningIcon name={item.icon} />{item.label}</Link>; })}</nav><WorkspaceLinks isInstructor={isInstructor} isAdmin={isAdmin} /><div className="sidebar-bottom"><p className="eyebrow">Growvelt Learning</p><p>Learn, teach, and grow from one account.</p><Link href="/teach">Teach on Growvelt</Link></div></aside>
    <div className="shell-content"><header className="app-header"><Link href="/dashboard" className="back-link">Learning home</Link><div className="header-tools"><ThemeControl /><SignOutButton /></div></header><div className="mobile-workspace-links"><WorkspaceLinks isInstructor={isInstructor} isAdmin={isAdmin} /></div><main id="main-content" className="dashboard-main">{children}</main></div>
    <nav className="mobile-nav" aria-label="Learning navigation">{navigation.map((item) => { const active = isActive(item.href); return <Link className={active ? "active" : ""} aria-current={active ? "page" : undefined} href={item.href} key={item.label}><LearningIcon name={item.icon} size={18} /><small>{item.mobileLabel ?? item.label}</small></Link>; })}</nav>
  </div>;
}
