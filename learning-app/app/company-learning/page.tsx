import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import FooterWrapper from "@/app/components/FooterWrapper";
import { PublicHeader } from "@/app/components/public-header";

export const metadata: Metadata = { title: "Company learning", description: "Bring your people into a private Growvelt Learning workspace." };

export default function CompanyLearningPage() {
  return <div className="public-page"><PublicHeader /><main className="company-learning-public section-shell"><section><p className="eyebrow">Growvelt for organizations</p><h1>Learning for every person on your team.</h1><p>Give employees one private learning workspace, invite them into seats, and prepare your company for course assignments and progress reporting.</p><div className="hero-actions"><Link className="button button-primary" href="/sign-up?next=%2Fdashboard%2Fcompany">Create company workspace</Link><Link className="button button-secondary" href="/sign-in?next=%2Fdashboard%2Fcompany">Sign in to Company learning</Link></div><p className="company-learning-note">Company workspaces are private. Only invited members and company administrators can access company information.</p></section><figure><Image src="/images/partner-people.png" alt="Colleagues learning together" width={1200} height={900} priority /></figure><section className="company-learning-steps"><article><span>01</span><h2>Create your workspace</h2><p>Set up one private company learning home for your organization.</p></article><article><span>02</span><h2>Invite employees</h2><p>Use seats to invite employees or company administrators securely.</p></article><article><span>03</span><h2>Assign learning</h2><p>Course assignment, progress, and reporting arrive in the next phase.</p></article></section></main><FooterWrapper /></div>;
}
