import Link from "next/link";
import { CourseCard } from "@/app/components/course-card";
import { LearningMark } from "@/app/components/learning-mark";
import { PathCard } from "@/app/components/path-card";
import { PublicHeader } from "@/app/components/public-header";
import { mockCourses, mockLearningPaths, mockSkillAreas } from "@/app/lib/mock-data";

export default function HomePage() {
  return (
    <div className="public-page">
      <PublicHeader />
      <main>
        <section className="hero section-shell" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">Growvelt Learning</p>
            <h1 id="hero-title">Learn practical skills. Build proof. Grow into opportunity.</h1>
            <p className="hero-lede">
              Structured digital learning designed around real practice, thoughtful progress,
              and work you can be proud to show.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/learn">Explore learning</Link>
              <a className="button button-secondary" href="#how-it-works">How it works</a>
            </div>
          </div>
          <div className="learning-map" aria-label="Growvelt Learning journey">
            <div className="map-label">A focused learning journey</div>
            <ol>
              <li><span>01</span><strong>Learn</strong><small>Understand the essentials</small></li>
              <li><span>02</span><strong>Practice</strong><small>Build practical confidence</small></li>
              <li><span>03</span><strong>Prove</strong><small>Complete meaningful work</small></li>
              <li><span>04</span><strong>Grow</strong><small>Carry your progress forward</small></li>
            </ol>
          </div>
        </section>

        <section className="section-shell" aria-labelledby="skills-title">
          <div className="section-heading">
            <div><p className="eyebrow">Explore skills</p><h2 id="skills-title">Build capability, one focused step at a time.</h2></div>
            <Link href="/learn" className="text-link">See all skill areas <span aria-hidden="true">→</span></Link>
          </div>
          <div className="skill-grid">
            {mockSkillAreas.map((skill) => <Link href="/learn" className="skill-card" key={skill.name}><span className="skill-mark">{skill.shortLabel}</span><h3>{skill.name}</h3><p>{skill.description}</p></Link>)}
          </div>
        </section>

        <section id="paths" className="section-shell" aria-labelledby="paths-title">
          <div className="section-heading"><div><p className="eyebrow">Curated paths</p><h2 id="paths-title">A clearer route from first lesson to practical work.</h2></div></div>
          <div className="path-grid">{mockLearningPaths.map((path) => <PathCard key={path.title} path={path} />)}</div>
        </section>

        <section className="section-shell" aria-labelledby="courses-title">
          <div className="section-heading"><div><p className="eyebrow">Featured learning</p><h2 id="courses-title">Start with a course designed to move beyond theory.</h2></div><Link href="/learn" className="text-link">Explore all courses <span aria-hidden="true">→</span></Link></div>
          <div className="course-grid">{mockCourses.slice(0, 3).map((course) => <CourseCard course={course} key={course.slug} />)}</div>
          <p className="demo-note">Course content shown here is illustrative demo content for the Phase 1A visual foundation.</p>
        </section>

        <section id="how-it-works" className="proof-band section-shell" aria-labelledby="proof-title">
          <div><p className="eyebrow">Not just watching</p><h2 id="proof-title">Learning that leaves you with something to show.</h2></div>
          <div className="proof-steps">
            <article><span>Learn</span><div><p>Follow an intentional sequence, not a scattered playlist.</p><small>Structured lesson path</small></div></article>
            <article><span>Practice</span><div><p>Use projects and applied exercises to make the skill useful.</p><small>Practical project brief</small></div></article>
            <article><span>Prove</span><div><p>Work toward credible completion and verified proof as the platform grows.</p><small>Future verified record</small></div></article>
          </div>
        </section>

        <section className="certificate-panel section-shell" aria-labelledby="certificate-title">
          <div className="certificate-paper"><LearningMark compact /><span>Growvelt Learning</span><strong>Proof of completion</strong><small>Future certificate experience preview</small><div className="certificate-seal">VERIFIED<br />WHEN EARNED</div></div>
          <div><p className="eyebrow">Built for proof</p><h2 id="certificate-title">Make progress visible.</h2><p>Growvelt Learning is being shaped around practical outcomes and future verifiable completion—not decorative credentials.</p><Link href="/certificates" className="text-link">View certificate space <span aria-hidden="true">→</span></Link></div>
        </section>

        <section className="teach-band section-shell" aria-labelledby="teach-title">
          <div><p className="eyebrow">Teach with intention</p><h2 id="teach-title">Have practical expertise worth sharing?</h2><p>Growvelt Learning will welcome thoughtfully reviewed Instructor-led courses when its publishing foundation is ready.</p></div>
          <Link className="button button-secondary" href="/teach">Teach on Growvelt</Link>
        </section>

        <section className="final-cta section-shell"><p className="eyebrow">Your next focused step</p><h2>Choose a skill worth practising.</h2><Link className="button button-primary" href="/learn">Explore Growvelt Learning</Link></section>
      </main>
      <footer className="public-footer">
        <div className="section-shell footer-inner"><LearningMark /><p>Growvelt Learning is part of Growvelt.</p><nav aria-label="Growvelt ecosystem"><a href="https://www.courses.growvelt.com">Courses site</a><a href="https://growvelt.com">Growvelt Careers</a><a href="https://www.courses.growvelt.com/terms-of-service.html">Terms</a><a href="https://www.courses.growvelt.com/privacy-policy.html">Privacy</a></nav></div>
      </footer>
    </div>
  );
}
