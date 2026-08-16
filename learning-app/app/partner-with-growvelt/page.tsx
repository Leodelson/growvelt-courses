import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, GraduationCap, Handshake, HeartHandshake } from "lucide-react";
import FooterWrapper from "@/app/components/FooterWrapper";
import { PublicHeader } from "@/app/components/public-header";
import { PublicInquiryForm } from "@/app/components/public-inquiry-form";

export const metadata: Metadata = {
  title: "Partner with Growvelt | Digital skills and opportunity",
  description: "Partner with Growvelt on practical learning, workforce development, jobs, career opportunity, and digital-inclusion initiatives.",
  alternates: { canonical: "/partner-with-growvelt" },
  openGraph: { url: "/partner-with-growvelt", title: "Partner with Growvelt | Digital skills and opportunity" },
};

const partnershipTypes = [
  { title: "Corporate partners", description: "Build practical training, workforce development, employer access, or capacity-building programmes with Growvelt.", Icon: Building2 },
  { title: "Academic institutions", description: "Explore learner support, practical workshops, curriculum collaboration, and career-readiness initiatives.", Icon: GraduationCap },
  { title: "Nonprofits and NGOs", description: "Work together on inclusive digital-skills programmes and community-focused learning opportunities.", Icon: HeartHandshake },
  { title: "Community partners", description: "Connect learners, job seekers, mentors, and opportunities through thoughtful referral or collaboration models.", Icon: Handshake },
];

export default function PartnerWithGrowveltPage() {
  return <div className="public-page partner-page">
    <PublicHeader />
    <main>
      <section className="partner-hero section-shell" aria-labelledby="partner-title">
        <div>
          <p className="eyebrow">Partner with Growvelt</p>
          <h1 id="partner-title">Build practical digital-skills opportunities with us.</h1>
          <p>Growvelt brings learning, career development, and opportunity closer together. We welcome partnerships that make useful skills and meaningful next steps more accessible.</p>
          <div className="hero-actions"><a className="button button-primary" href="#partner-form">Start a partnership conversation</a><Link className="button button-secondary" href="/about">About Growvelt</Link></div>
        </div>
        <aside className="partner-hero-card">
          <p className="eyebrow">A practical collaboration</p>
          <strong>Skills development that connects to what people can do next.</strong>
          <div><span>Learning</span><ArrowRight aria-hidden="true" /><span>Career readiness</span><ArrowRight aria-hidden="true" /><span>Opportunity</span></div>
        </aside>
      </section>

      <section className="section-shell partner-introduction" aria-labelledby="partner-why-title">
        <div><p className="eyebrow">Why collaborate</p><h2 id="partner-why-title">A shared route from learning to confidence and opportunity.</h2></div>
        <p>Partnerships work best when they have a clear audience, an honest learning need, and a useful outcome. Growvelt can explore ideas for training, practical workshops, learner support, and career-focused programmes with your team.</p>
      </section>

      <section className="section-shell partner-type-grid" aria-labelledby="partner-types-title">
        <div className="partner-section-heading"><p className="eyebrow">Ways to work together</p><h2 id="partner-types-title">Partnerships shaped around useful outcomes.</h2></div>
        <div>{partnershipTypes.map(({ title, description, Icon }) => <article key={title}><Icon aria-hidden="true" /><h3>{title}</h3><p>{description}</p></article>)}</div>
      </section>

      <section className="section-shell partner-process" aria-labelledby="partner-process-title">
        <div><p className="eyebrow">How we begin</p><h2 id="partner-process-title">A clear conversation before a commitment.</h2></div>
        <ol><li><span>01</span><div><strong>Share the opportunity</strong><p>Tell us who you want to support and the outcome you want to create.</p></div></li><li><span>02</span><div><strong>Explore the fit</strong><p>We review the idea, available learning paths, and practical delivery needs together.</p></div></li><li><span>03</span><div><strong>Design the next step</strong><p>Agree a focused way to move forward, with clear responsibilities and learner value.</p></div></li></ol>
      </section>

      <div id="partner-form" className="section-shell"><PublicInquiryForm kind="partnership" /></div>
    </main>
    <FooterWrapper />
  </div>;
}
