import Link from "next/link";
import { LearningMark } from "@/app/components/learning-mark";
import { PublicHeader } from "@/app/components/public-header";
import FooterWrapper from "@/app/components/FooterWrapper";
import { createClient } from "@/app/lib/supabase/server";

const jobsHref = "https://growvelt.com";

export default async function HomePage() {
  const { data: { user } } = await (await createClient()).auth.getUser();
  const exploreHref = user ? "/dashboard/explore" : "/sign-up?next=%2Fdashboard%2Fexplore";

  return <div className="public-page">
    <PublicHeader />
    <main>
      <section className="hero section-shell" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Growvelt Learning</p>
          <h1 id="hero-title">Learn practical skills. Complete real courses. Carry proof forward.</h1>
          <p className="hero-lede">Growvelt Learning brings reviewed Instructor-led courses, structured lessons, assessments, and earned certificates into one focused learning experience.</p>
          <div className="hero-actions">
            <Link className="button button-primary" href={exploreHref}>Explore courses</Link>
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
        <a className="button button-primary" href={jobsHref} target="_blank" rel="noreferrer">Apply for jobs<span className="sr-only"> in a new tab</span></a>
      </section>

      <section className="final-cta section-shell"><p className="eyebrow">Your next focused step</p><h2>Choose a published course and begin where you are.</h2><Link className="button button-primary" href={exploreHref}>Explore courses</Link></section>
    </main>
    <FooterWrapper />
  </div>;
}
