import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import FooterWrapper from "@/app/components/FooterWrapper";
import { LearningMark } from "@/app/components/learning-mark";
import { PublicHeader } from "@/app/components/public-header";

export const metadata: Metadata = {
  title: "About Growvelt",
  description: "Learn about Growvelt, our practical learning approach, career support, and mission to connect skills with opportunity.",
};

const offerings = [
  "Real-world projects and mentorship",
  "Career consultation and job support",
  "Supportive, beginner-friendly teaching",
  "Remote and onsite learning options",
];

const team = [
  { name: "Ndu Leonard Chikaodinaka", role: "Founder & CEO @ Growvelt", image: "/images/about/ndu-leonard.jpg", skills: "Leadership · Data Analytics · Technology", imagePosition: "50% 66%" },
  { name: "Ndu Faith Chidimma", role: "Communications & Brand Lead", image: "/images/about/ndu-faith.jpg", skills: "Leadership · Strategy · Public Relations", imagePosition: "50% 45%" },
  { name: "Ndu Queeneth Ezinne", role: "Head of Admin & Support Team", image: "/images/about/ndu-queeneth.jpg", skills: "Office management · Coordination · Reporting", imagePosition: "50% 42%" },
  { name: "Joy Ezedo", role: "Data Analytics Instructor & Support Team", image: "/images/about/joy-ezedo.jpg", skills: "Data Analysis · Excel · SQL · Power BI", imagePosition: "50% 35%" },
  { name: "Godswill Ukoha", role: "Graphics Design Instructor", image: "/images/about/godswill-ukoha.jpg", skills: "Adobe Photoshop · Illustrator · Brand Design", imagePosition: "50% 36%" },
];

export default function AboutPage() {
  return (
    <div className="public-page about-page">
      <PublicHeader />
      <main>
        <section className="about-hero section-shell" aria-labelledby="about-title">
          <div>
            <p className="eyebrow">About Growvelt</p>
            <h1 id="about-title">Practical learning, career growth, and opportunity in one connected ecosystem.</h1>
            <p className="about-hero-lede">Growvelt connects skills development, career intelligence, and employment helping people move from learning to career readiness, verified skills, and opportunity.</p>
            <div className="hero-actions">
              <Link href="/dashboard/explore" className="button button-primary">Explore courses</Link>
              <a href="https://growvelt.com" target="_blank" rel="noreferrer" className="button button-secondary">Explore careers<span className="sr-only"> in a new tab</span></a>
            </div>
          </div>
          <aside className="about-hero-card" aria-label="Growvelt at a glance">
            <LearningMark compact />
            <div className="about-hero-copy">
              <p>Growvelt is a technology ecosystem connecting skills development, career intelligence, and employment; helping emerging-market talent move from learning → career readiness → verified skills → employment.</p>
              <p>We bring learning, career development, intelligent hiring tools, and real job opportunities together in one platform.</p>
            </div>
            <dl>
              <div><dt>Founded</dt><dd>2026</dd></div>
              <div><dt>Focus</dt><dd>Skills to opportunity</dd></div>
            </dl>
          </aside>
        </section>

        <section className="about-split section-shell" aria-labelledby="who-title">
          <Image src="/images/about/who-we-are.jpg" alt="A Growvelt tutoring and learning session" width={1280} height={853} priority />
          <div>
            <p className="eyebrow">Who we are</p>
            <h2 id="who-title">Built to bridge the skills gap with career-oriented learning.</h2>
            <p>Growvelt was founded to make practical technology education and career support more connected. We help learners develop useful skills in data, technology, and beyond, while bringing opportunities and career development closer together.</p>
          </div>
        </section>

        <section className="about-principles section-shell" aria-label="Growvelt vision and mission">
          <Image src="/images/about/vision.jpg" alt="Books representing Growvelt's learning vision" width={1280} height={853} />
          <div className="about-principle-cards">
            <article><p className="eyebrow">Our vision</p><h2>A leading technology hub where practical learning creates global impact.</h2><p>We aim to help individuals and businesses unlock their potential in the digital era through accessible, meaningful technology education.</p></article>
            <article><p className="eyebrow">Our mission</p><h2>Equip learners with relevant skills and organizations with useful technology support.</h2><p>We provide hands-on learning experiences and tailored solutions that help people build confidence, apply their knowledge, and grow.</p></article>
          </div>
        </section>

        <section className="about-split about-split-reverse section-shell" aria-labelledby="offer-title">
          <Image src="/images/about/offerings.png" alt="Growvelt learning and coaching experience" width={1536} height={1024} />
          <div><p className="eyebrow">What we offer</p><h2 id="offer-title">Learning that stays close to real career outcomes.</h2><ul className="about-check-list">{offerings.map((offering) => <li key={offering}>{offering}</li>)}</ul><Link href="/teach" className="text-link">Teach with Growvelt <span aria-hidden="true">→</span></Link></div>
        </section>

        <section className="about-split section-shell" aria-labelledby="why-title">
          <Image src="/images/about/why-growvelt.jpg" alt="Digital learning and technology workspace" width={1280} height={853} />
          <div><p className="eyebrow">Why Growvelt</p><h2 id="why-title">A supportive route from learning to real application.</h2><p>Our Instructor-led approach, hands-on learning model, and flexible training options are designed to help learners gain practical knowledge they can carry into their next opportunity.</p><Link href="/dashboard/explore" className="text-link">Find a course to begin <span aria-hidden="true">→</span></Link></div>
        </section>

        <section className="about-team section-shell" aria-labelledby="team-title">
          <div className="about-team-heading"><p className="eyebrow">Our team</p><h2 id="team-title">People building learning and career support with intention.</h2><p>Growvelt brings together practitioners focused on useful education, thoughtful career development, and accessible opportunity.</p></div>
          <div className="about-team-grid">
            {team.map((member) => <article className="about-team-card" key={member.name}><Image src={member.image} alt={member.name} width={300} height={300} style={{ objectPosition: member.imagePosition }} /><div><h3>{member.name}</h3><p className="about-team-role">{member.role}</p><p>{member.skills}</p></div></article>)}
          </div>
        </section>

        <section className="about-final section-shell" aria-labelledby="about-cta-title"><p className="eyebrow">Build what comes next</p><h2 id="about-cta-title">Learn practical skills. Apply them with confidence.</h2><Link href="/dashboard/explore" className="button button-primary">Explore Growvelt Learning</Link></section>
      </main>
      <FooterWrapper />
    </div>
  );
}
