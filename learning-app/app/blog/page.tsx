import type { Metadata } from "next";
import Link from "next/link";
import FooterWrapper from "@/app/components/FooterWrapper";
import { PublicHeader } from "@/app/components/public-header";

export const metadata: Metadata = {
  title: "Growvelt Blog | Learning, careers, and practical skills",
  description: "Practical articles from Growvelt on learning, careers, data, technology, and turning skills into opportunity.",
  alternates: { canonical: "/blog" },
  openGraph: { url: "/blog", title: "Growvelt Blog | Learning, careers, and practical skills" },
};

const articles = [
  {
    topic: "Career readiness",
    title: "Turn practical learning into a career-ready story",
    excerpt: "A strong next step is not just another course. It is a clear record of what you learned, what you built, and how you can apply it.",
    readTime: "5 min read",
  },
  {
    topic: "Data careers",
    title: "How to stand out as a data analyst",
    excerpt: "Focus your portfolio on useful business questions, explain your decisions, and show the steps behind your analysis not just a finished dashboard.",
    readTime: "6 min read",
  },
  {
    topic: "Practical skills",
    title: "SQL habits every analyst should know",
    excerpt: "Good SQL is readable, testable, and intentional. These habits help make your work easier to review and safer to reuse.",
    readTime: "4 min read",
  },
  {
    topic: "Tools",
    title: "Power BI or Tableau: choose for the work in front of you",
    excerpt: "The better tool depends on the people using the report, the data environment, and the questions the team needs answered.",
    readTime: "5 min read",
  },
  {
    topic: "Learning strategy",
    title: "Build a learning plan that survives a busy week",
    excerpt: "Small, repeatable sessions and visible milestones are more reliable than saving all your learning for a free weekend.",
    readTime: "3 min read",
  },
  {
    topic: "Career growth",
    title: "A portfolio should show thinking, not only finished work",
    excerpt: "Use concise context, the problem, your approach, and what changed because of the work. That makes your skills easier to trust.",
    readTime: "4 min read",
  },
];

export default function BlogPage() {
  return (
    <div className="public-page blog-page">
      <PublicHeader />
      <main>
        <section className="blog-hero section-shell">
          <div>
            <p className="eyebrow">Growvelt Journal</p>
            <h1>Ideas for learning well and moving your career forward.</h1>
            <p>Practical guidance from Growvelt on building skills, showing your work, finding opportunities, and growing with confidence.</p>
          </div>
          <aside aria-label="Growvelt journal focus">
            <p>What we cover</p>
            <strong>Skills that lead somewhere.</strong>
            <span>Learning · careers · technology · opportunity</span>
          </aside>
        </section>

        <section className="blog-featured section-shell" aria-labelledby="featured-story-title">
          <article>
            <p className="eyebrow">Featured perspective</p>
            <h2 id="featured-story-title">Learning is more useful when it connects to the work you want to do next.</h2>
            <p>Growvelt brings course progress, practical assessment, certificates, career development, and job opportunity into one connected experience. The aim is simple: make skill growth visible and usable.</p>
            <div>
              <Link className="button primary-button" href="/learn">Explore courses</Link>
              <a className="button secondary-button" href="https://growvelt.com" target="_blank" rel="noreferrer">Explore careers <span className="sr-only"> on Growvelt Careers</span></a>
            </div>
          </article>
          <div className="blog-featured-art" aria-hidden="true">
            <span>LEARN</span><span>APPLY</span><span>SUCCEED</span>
          </div>
        </section>

        <section className="section-shell blog-stories" aria-labelledby="journal-stories-title">
          <div className="blog-section-heading">
            <div><p className="eyebrow">Fresh thinking</p><h2 id="journal-stories-title">Career and learning notes</h2></div>
            <p>Clear, practical pieces you can use as you choose a course, develop a portfolio, or prepare for your next opportunity.</p>
          </div>
          <div className="blog-topic-strip" aria-label="Topics we write about">
            <span>Career readiness</span><span>Data skills</span><span>Technology</span><span>Learning strategy</span><span>Job search</span>
          </div>
          <div className="blog-grid">
            {articles.map((article) => <article className="blog-card" key={article.title}>
              <p className="blog-card-topic">{article.topic}</p>
              <h3>{article.title}</h3>
              <p>{article.excerpt}</p>
              <small>{article.readTime}</small>
            </article>)}
          </div>
        </section>

        <section className="section-shell blog-editorial-cta">
          <p className="eyebrow">Keep building</p>
          <h2>Choose a practical course, complete it at your pace, and keep your progress in one place.</h2>
          <Link className="button primary-button" href="/learn">Find a course</Link>
        </section>
      </main>
      <FooterWrapper />
    </div>
  );
}
