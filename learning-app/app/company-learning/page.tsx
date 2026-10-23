import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import FooterWrapper from "@/app/components/FooterWrapper";
import { PublicHeader } from "@/app/components/public-header";
import styles from "@/app/components/public/secondary-pages.module.css";

export const metadata: Metadata = {
  title: "Team Training for your team",
  description: "Help your team build practical skills with Growvelt. Create a private workspace, assign courses, invite employees, and track learning progress.",
  alternates: { canonical: "/company-learning" },
  openGraph: {
    url: "/company-learning",
    title: "Team Training for your team | Growvelt",
    description: "Create a private company workspace, assign practical courses, invite employees, and follow team learning progress.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Team Training for your team | Growvelt",
    description: "Create a private company workspace, assign practical courses, invite employees, and follow team learning progress.",
  },
};

export default function CompanyLearningPage() {
  return <div className="public-page"><PublicHeader /><main id="public-main" className={styles.page}>
    <section className={`section-shell ${styles.hero}`}>
      <div className={styles.intro}><p className="eyebrow">Growvelt for organizations</p><h1>Training for every person on your team.</h1><p>Bring your people together in a private workspace. Assign courses, follow employee progress and use reports to plan the next step.</p><div className="hero-actions"><Link className="button button-primary" href="/sign-up?next=%2Fdashboard%2Fcompany">Create company workspace</Link><Link className="button button-secondary" href="/sign-in?next=%2Fdashboard%2Fcompany">Sign in</Link></div><p className={styles.note}>Company workspaces are private. Only invited members and company administrators can access company information.</p></div>
      <figure className={styles.image}><Image src="/images/partner-people.png" alt="Colleagues learning together" width={1200} height={900} priority /></figure>
    </section>
    <section className={`section-shell ${styles.section}`} aria-labelledby="company-journey"><header><p className="eyebrow">From setup to progress</p><h2 id="company-journey">Give team learning a place to grow.</h2></header><ol className={styles.cards}>
      <li><span className={styles.number}>01</span><h3>Create your workspace</h3><p>Set up a private learning home for your organization and manage its available seats.</p></li>
      <li><span className={styles.number}>02</span><h3>Bring your people in</h3><p>Invite employees and company administrators, then assign courses to workspace members.</p></li>
      <li><span className={styles.number}>03</span><h3>Follow their progress</h3><p>Review assignment progress and workspace reports to see how learning is moving forward.</p></li>
    </ol></section>
    <section className={`section-shell ${styles.section}`} aria-labelledby="company-questions"><header><p className="eyebrow">Before you begin</p><h2 id="company-questions">A workspace that fits your team.</h2></header><div className={styles.questions}><details><summary>Does an invitation include paid course access?</summary><p>An invitation adds someone to your workspace. Paid course access follows the purchase and assignment requirements shown in Team Training.</p></details><details><summary>What can company administrators see?</summary><p>Administrators can review company assignments and their associated progress. Company reporting is separate from an employee’s complete personal learning history.</p></details><details><summary>Planning a larger learning initiative?</summary><p><Link href="/partner-with-growvelt">Talk to Growvelt about a partnership</Link> for your organization’s learning goals.</p></details></div></section>
  </main><FooterWrapper /></div>;
}
