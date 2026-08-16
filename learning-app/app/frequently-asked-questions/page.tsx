import type { Metadata } from "next";
import Link from "next/link";
import FooterWrapper from "@/app/components/FooterWrapper";
import { PublicHeader } from "@/app/components/public-header";

export const metadata: Metadata = {
  title: "Frequently Asked Questions | Growvelt Learning and Careers",
  description: "Answers to common Growvelt questions about learning, certificates, teaching, jobs, careers, support, and partnerships.",
  alternates: { canonical: "/frequently-asked-questions" },
  openGraph: { url: "/frequently-asked-questions", title: "Frequently Asked Questions | Growvelt" },
};

const groups = [
  {
    title: "Learning and certificates",
    items: [
      ["How do I find a course?", "Use the published course catalog to search current courses by title, topic, category, level, and access details."],
      ["What does it take to earn a certificate?", "Certificates are issued from an eligible completed course record. Text and video activities must be completed, and required quizzes must be passed."],
      ["Can I verify a Growvelt certificate?", "Yes. Each issued certificate has a unique public verification code and a verification page."],
      ["Can I teach on Growvelt?", "You can apply to teach, then create a draft course for review once your Instructor access is approved."],
    ],
  },
  {
    title: "Jobs and careers",
    items: [
      ["Where do I apply for jobs?", "Growvelt Careers is the jobs experience. Use it to explore current opportunities and follow the application route for the role."],
      ["Does completing a course guarantee a job?", "No. Learning and certificates demonstrate completed learning, but no course or certificate guarantees an interview, offer, salary, visa, or employment outcome."],
      ["Can an employer work with Growvelt?", "Yes. Employers can visit Growvelt Careers for job and hiring tools, or contact us about an employer or workforce partnership."],
    ],
  },
  {
    title: "Support and partnerships",
    items: [
      ["How do I contact Growvelt?", "Use the Contact page for course support, account questions, jobs, career tools, teaching enquiries, or a general message."],
      ["What kinds of partnerships does Growvelt consider?", "Growvelt considers practical learning, workforce development, jobs and employer access, academic, nonprofit, community, and career-development initiatives."],
      ["Where can I get WhatsApp support?", "The Contact page and the site footer include Growvelt’s current WhatsApp support channel."],
    ],
  },
] as const;

export default function FrequentlyAskedQuestionsPage() {
  return <div className="public-page faq-page">
    <PublicHeader />
    <main>
      <section className="faq-page-hero section-shell">
        <p className="eyebrow">Growvelt help centre</p>
        <h1>Questions about learning, careers, or working with Growvelt?</h1>
        <p>Start here for direct answers across Growvelt Learning and Growvelt Careers. If your question is not covered, the team is ready to help.</p>
        <div className="hero-actions"><Link className="button button-primary" href="/contact">Contact us</Link><Link className="button button-secondary" href="/learn">Explore courses</Link></div>
      </section>
      <section className="faq-page-groups section-shell" aria-label="Frequently asked questions">
        {groups.map((group) => <section key={group.title}><h2>{group.title}</h2>{group.items.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</section>)}
      </section>
    </main>
    <FooterWrapper />
  </div>;
}
