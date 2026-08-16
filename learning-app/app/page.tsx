import Image from "next/image";
import Link from "next/link";
import { LearningMark } from "@/app/components/learning-mark";
import { PublicHeader } from "@/app/components/public-header";
import FooterWrapper from "@/app/components/FooterWrapper";
import { growveltOrganizationJsonLd } from "@/app/lib/seo";

const jobsHref = "https://growvelt.com";

const growveltVideos = [
  { id: "5PG1CrJfZYU", title: "Introducing Growvelt Careers for Employers" },
  { id: "cFJt2gytwjY", title: "How to install the Growvelt app" },
  { id: "Xac1qNAcKHc", title: "How employers hire on Growvelt" },
];

const resources = [
  { number: "01", title: "Choose a practical starting point", copy: "Explore published courses and use the level, category, and access details to decide what fits your next step.", href: "/learn", link: "Explore courses" },
  { number: "02", title: "Keep your learning record together", copy: "Your enrolled courses, completed activities, quiz progress, and earned certificates stay connected to your Learning account.", href: "/dashboard/my-learning", link: "Open My Learning" },
  { number: "03", title: "Connect skills to opportunity", copy: "When you are ready to explore work, Growvelt Careers is there for job opportunities and career tools.", href: jobsHref, link: "Explore careers", external: true },
];

const questions = [
  { question: "What can I learn on Growvelt?", answer: "The published catalog is the source of truth for current Growvelt courses. Each course page shows its subject, level, Instructor, access details, and curriculum." },
  { question: "Are courses suitable for beginners?", answer: "Many courses are designed with beginners in mind, but the right place to check is each course’s level and description before you enroll." },
  { question: "How do certificates work?", answer: "A Growvelt certificate is available only after you complete every eligible activity in a course. Each issued certificate has a public verification code." },
  { question: "Can Growvelt also help with jobs and career growth?", answer: "Yes. Growvelt Careers is the separate jobs and career experience for finding opportunities, while Growvelt Learning is where you can build practical skills and complete courses." },
  { question: "Where can I get support?", answer: "You can contact the Growvelt team through email, WhatsApp, or the Contact page when you need help with a course, account, job, or career question." },
];

const learningAudiences = [
  { title: "Learning with a clear goal", copy: "Use a structured course and visible progress record to build a skill you can explain with confidence.", image: "/images/learning-woman-with-laptop.jpg" },
  { title: "Teaching practical expertise", copy: "Bring your real-world knowledge into a reviewed Growvelt course and reach learners with a clear curriculum.", image: "/images/teaching-practical-expertise.jpg" },
  { title: "Building workforce capability", copy: "Start a conversation about practical training, career readiness, or a learning initiative for your organisation or community.", image: "/images/pexels-alexander-suhorucov-6457554.jpg" },
];

export default function HomePage() {

  return <div className="public-page">
    <PublicHeader />
    <main>
      <section className="hero section-shell" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Growvelt Learning</p>
          <h1 id="hero-title">Learn practical skills. Complete real courses. Carry proof forward.</h1>
          <p className="hero-lede">Growvelt Learning brings reviewed Instructor-led courses, structured lessons, assessments, and earned certificates into one focused learning experience.</p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/learn">Explore courses</Link>
            <a className="button button-secondary" href="#how-it-works">How learning works</a>
          </div>
        </div>
        <div className="learning-map" aria-label="Growvelt Learning journey">
          <p className="map-label">A focused learning journey</p>
          <ol>
            <li><span>01</span><strong>Discover</strong><small>Choose a published Growvelt course</small></li>
            <li><span>02</span><strong>Learn</strong><small>Move through lessons and assessments</small></li>
            <li><span>03</span><strong>Complete</strong><small>Build verified course progress</small></li>
            <li><span>04</span><strong>Prove</strong><small>Issue a certificate when you earn it</small></li>
          </ol>
        </div>
      </section>

      <section id="how-it-works" className="proof-band section-shell" aria-labelledby="how-title">
        <div><p className="eyebrow">How Growvelt Learning works</p><h2 id="how-title">A clear route from course discovery to earned proof.</h2></div>
        <div className="proof-steps">
          <article><span>Explore</span><div><p>Browse published courses reviewed by Growvelt before they become available to learners.</p><small>Reviewed course catalog</small></div></article>
          <article><span>Learn</span><div><p>Enroll in available free courses, complete text and video lessons, and pass required quizzes.</p><small>Saved learning progress</small></div></article>
          <article><span>Earn</span><div><p>When every required activity is complete, issue a certificate with a public verification code.</p><small>Verified certificate record</small></div></article>
        </div>
      </section>

      <section className="resource-library section-shell" aria-labelledby="resource-title">
        <div className="resource-library-heading"><div><p className="eyebrow">Learning resources</p><h2 id="resource-title">Useful steps around the course itself.</h2></div><p>Growvelt Learning is designed to make practical study, visible progress, and your next opportunity easier to connect.</p></div>
        <div className="resource-library-grid">
          {resources.map((resource) => <article key={resource.title}><span>{resource.number}</span><h3>{resource.title}</h3><p>{resource.copy}</p>{resource.external ? <a className="text-link" href={resource.href} target="_blank" rel="noreferrer">{resource.link}<span aria-hidden="true"> →</span><span className="sr-only"> in a new tab</span></a> : <Link className="text-link" href={resource.href}>{resource.link}<span aria-hidden="true"> →</span></Link>}</article>)}
        </div>
      </section>

      <section className="learning-audiences section-shell" aria-labelledby="audience-title">
        <div className="learning-audiences-heading"><p className="eyebrow">Built around real next steps</p><h2 id="audience-title">Learning can support more than one kind of progress.</h2><p>Whether you are learning, teaching, or planning a skills initiative, Growvelt keeps the next action clear.</p></div>
        <div className="learning-audiences-grid">
          {learningAudiences.map((audience) => <article key={audience.title}><Image src={audience.image} alt="" width={960} height={640} /><div><h3>{audience.title}</h3><p>{audience.copy}</p></div></article>)}
        </div>
      </section>

      <section className="growvelt-video-section section-shell" aria-labelledby="video-title">
        <div className="video-section-heading"><div><p className="eyebrow">Growvelt video guides</p><h2 id="video-title">See how Growvelt works in practice.</h2></div><p>Short official guides covering Growvelt Careers for employers, the Growvelt app, and how employers hire on Growvelt.</p></div>
        <div className="growvelt-video-grid">
          {growveltVideos.map((video) => <article key={video.id}><div className="growvelt-video-frame"><iframe src={`https://www.youtube-nocookie.com/embed/${video.id}?rel=0`} title={video.title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div><h3>{video.title}</h3><a className="text-link" href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer">Watch on YouTube <span aria-hidden="true">→</span><span className="sr-only"> in a new tab</span></a></article>)}
        </div>
      </section>

      <section className="certificate-panel section-shell" aria-labelledby="certificate-title">
        <div className="certificate-paper"><LearningMark compact /><span>Growvelt Learning</span><strong>Certificate of Completion</strong><small>Issued from a completed course record</small><div className="certificate-seal">VERIFIED<br />WHEN EARNED</div></div>
        <div><p className="eyebrow">Built for proof</p><h2 id="certificate-title">Completion is earned, then verifiable.</h2><p>Growvelt certificates are issued from your completed course record and can be verified with their certificate-specific reference code.</p><Link href="/dashboard/certificates" className="text-link">View your certificates <span aria-hidden="true">→</span></Link></div>
      </section>

      <section className="teach-band section-shell" aria-labelledby="teach-title">
        <div><p className="eyebrow">Teach with intention</p><h2 id="teach-title">Have practical expertise worth sharing?</h2><p>Apply to teach, build a draft course, and submit it to Growvelt for review before publication.</p></div>
        <Link className="button button-secondary" href="/teach">Teach on Growvelt</Link>
      </section>

      <section className="career-band section-shell" aria-labelledby="career-title">
        <div><p className="eyebrow">Grow beyond the course</p><h2 id="career-title">Ready to explore opportunities?</h2><p>Visit Growvelt Careers to find current job opportunities and apply through the Growvelt jobs experience.</p></div>
        <a className="button button-primary" href={jobsHref} target="_blank" rel="noreferrer">Explore Growvelt Careers<span className="sr-only"> in a new tab</span></a>
      </section>

      <section className="growvelt-faq section-shell" aria-labelledby="faq-title">
        <div className="faq-heading"><p className="eyebrow">Frequently asked questions</p><h2 id="faq-title">A few useful things to know before you begin.</h2><p><Link href="/frequently-asked-questions">Browse every Growvelt FAQ</Link> or <Link href="/contact">contact the team</Link> for something specific.</p></div>
        <div>{questions.map((item) => <details key={item.question}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}</div>
      </section>

      <section className="collaboration-band section-shell" aria-labelledby="collaboration-title">
        <div><p className="eyebrow">Build with Growvelt</p><h2 id="collaboration-title">Have a learning, workforce, or community initiative in mind?</h2><p>We welcome thoughtful partnership conversations that create useful skills and clearer opportunities for learners.</p></div>
        <div className="hero-actions"><Link className="button button-secondary" href="/partner-with-growvelt">Partner with Growvelt</Link></div>
      </section>

      <section className="final-cta section-shell"><p className="eyebrow">Your next focused step</p><h2>Choose a published course and begin where you are.</h2><Link className="button button-primary" href="/learn">Explore courses</Link></section>
    </main>
    <FooterWrapper />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(growveltOrganizationJsonLd) }} />
  </div>;
}
