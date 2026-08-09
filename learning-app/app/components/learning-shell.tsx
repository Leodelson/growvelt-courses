"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LearningIcon } from "@/app/components/learning-icon";
import { LearningMark } from "@/app/components/learning-mark";
import { ThemeControl } from "@/app/components/theme-control";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: "overview" as const },
  { href: "/dashboard#my-learning", label: "My Learning", icon: "learning" as const },
  { href: "/learn", label: "Explore", icon: "explore" as const },
  { href: "/certificates", label: "Certificates", icon: "certificate" as const },
  { href: "/settings", label: "Settings", icon: "settings" as const },
];

export function LearningShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <div className="app-shell">
    <aside className="learning-sidebar">
      <LearningMark />
      <nav aria-label="Learning navigation">
        {navigation.map((item) => <Link className={pathname === item.href ? "active" : ""} href={item.href} key={item.label}><LearningIcon name={item.icon} />{item.label}</Link>)}
      </nav>
      <div className="sidebar-bottom"><p className="eyebrow">Phase 1A</p><p>Visual shell demo</p><Link href="/teach">Teach on Growvelt</Link></div>
    </aside>
    <div className="shell-content">
      <header className="app-header"><Link href="/" className="back-link">← Learning home</Link><div className="header-tools"><ThemeControl /><button type="button" className="profile-button" aria-label="Open demo profile menu">GL</button></div></header>
      <main className="dashboard-main">{children}</main>
    </div>
    <nav className="mobile-nav" aria-label="Learning navigation">
      {navigation.map((item) => <Link className={pathname === item.href ? "active" : ""} href={item.href} key={item.label}><LearningIcon name={item.icon} size={18} /><small>{item.label}</small></Link>)}
    </nav>
  </div>;
}
