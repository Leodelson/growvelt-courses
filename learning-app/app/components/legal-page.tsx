import Link from "next/link";
import FooterWrapper from "@/app/components/FooterWrapper";
import { PublicHeader } from "@/app/components/public-header";

type LegalSection = { heading: string; paragraphs: string[]; bullets?: string[] };

function LegalParagraph({ children }: { children: string }) {
  const links = { "Privacy Policy": "/privacy-policy", "Cookie Policy": "/cookie-policy", "Contact us": "/contact" } as const;
  const parts = children.split(/(Privacy Policy|Cookie Policy|Contact us|support@growvelt\.com)/g);
  return <p>{parts.map((part, index) => {
    if (part === "support@growvelt.com") return <a className="legal-contact-link" href="mailto:support@growvelt.com" key={index}>{part}</a>;
    if (part in links) return <Link className="legal-contact-link" href={links[part as keyof typeof links]} key={index}>{part}</Link>;
    return part;
  })}</p>;
}

export function LegalPage({ title, summary, updated, sections }: { title: string; summary: string; updated: string; sections: LegalSection[] }) {
  return <div className="public-page legal-page">
    <PublicHeader />
    <main>
      <section className="legal-hero section-shell">
        <p className="eyebrow">Growvelt legal</p>
        <h1>{title}</h1>
        <p>{summary}</p>
        <small>Last updated: {updated}</small>
      </section>
      <section className="legal-layout section-shell">
        <aside>
          <p className="eyebrow">On this page</p>
          <ol>{sections.map((section, index) => <li key={section.heading}><a href={`#legal-section-${index + 1}`}>{section.heading.replace(/^\d+\.\s*/, "")}</a></li>)}</ol>
          <Link href="/about" className="text-link">About Growvelt <span aria-hidden="true">&rarr;</span></Link>
        </aside>
        <article>{sections.map((section, index) => <section id={`legal-section-${index + 1}`} key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs.map((paragraph) => <LegalParagraph key={paragraph}>{paragraph}</LegalParagraph>)}
          {section.bullets ? <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul> : null}
        </section>)}</article>
      </section>
    </main>
    <FooterWrapper />
  </div>;
}
