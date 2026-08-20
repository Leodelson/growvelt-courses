"use client";

import Image from "next/image";
import Link from "next/link";
import { LearningMark } from "@/app/components/learning-mark";
import { HomeHeroCarousel } from "@/app/components/home-hero-carousel";
import { PublicHeader } from "@/app/components/public-header";
import FooterWrapper from "@/app/components/FooterWrapper";
import { growveltOrganizationJsonLd } from "@/app/lib/seo";
import { useLanguage } from "@/app/components/language-provider";

const jobsHref = "https://growvelt.com";

const growveltVideos = [
  { id: "b_hmIZRnD1Q", title: "Growvelt assistant now available with live support" },
  { id: "cFJt2gytwjY", title: "How to install the Growvelt app" },
  { id: "Xac1qNAcKHc", title: "How employers hire on Growvelt" },
];

export default function HomePage() {
  const { t } = useLanguage();
  const localizedResources = [
    { number: "01", title: t("home.resourceOneTitle"), copy: t("home.resourceOneCopy"), href: "/learn", link: t("public.explore") },
    { number: "02", title: t("home.resourceTwoTitle"), copy: t("home.resourceTwoCopy"), href: "/dashboard/my-learning", link: t("nav.learning") },
    { number: "03", title: t("home.resourceThreeTitle"), copy: t("home.resourceThreeCopy"), href: jobsHref, link: t("home.exploreCareers"), external: true },
  ];
  const localizedAudiences = [
    { title: t("home.audienceOneTitle"), copy: t("home.audienceOneCopy"), image: "/images/learning-woman-with-laptop.jpg" },
    { title: t("home.audienceTwoTitle"), copy: t("home.audienceTwoCopy"), image: "/images/teaching-practical-expertise.jpg" },
    { title: t("home.audienceThreeTitle"), copy: t("home.audienceThreeCopy"), image: "/images/pexels-alexander-suhorucov-6457554.jpg" },
  ];
  const localizedQuestions = [
    { question: t("home.faqOneQuestion"), answer: t("home.faqOneAnswer") },
    { question: t("home.faqTwoQuestion"), answer: t("home.faqTwoAnswer") },
    { question: t("home.faqThreeQuestion"), answer: t("home.faqThreeAnswer") },
    { question: t("home.faqFourQuestion"), answer: t("home.faqFourAnswer") },
    { question: t("home.faqFiveQuestion"), answer: t("home.faqFiveAnswer") },
  ];

  return <div className="public-page">
    <PublicHeader />
    <main>
      <HomeHeroCarousel />

      <section id="how-it-works" className="proof-band section-shell" aria-labelledby="how-title">
        <div><p className="eyebrow">{t("home.howEyebrow")}</p><h2 id="how-title">{t("home.howTitle")}</h2></div>
        <div className="proof-steps">
          <article><span>{t("home.explore")}</span><div><p>{t("home.exploreStepCopy")}</p><small>{t("home.exploreStepNote")}</small></div></article>
          <article><span>{t("home.learnStep")}</span><div><p>{t("home.learnDetailCopy")}</p><small>{t("home.learnDetailNote")}</small></div></article>
          <article><span>{t("home.earn")}</span><div><p>{t("home.earnStepCopy")}</p><small>{t("home.earnStepNote")}</small></div></article>
        </div>
      </section>

      <section className="resource-library section-shell" aria-labelledby="resource-title">
        <div className="resource-library-heading"><div><p className="eyebrow">{t("home.resourceEyebrow")}</p><h2 id="resource-title">{t("home.resourceTitle")}</h2></div><p>{t("home.resourceCopy")}</p></div>
        <div className="resource-library-grid">
          {localizedResources.map((resource) => <article key={resource.title}><span>{resource.number}</span><h3>{resource.title}</h3><p>{resource.copy}</p>{resource.external ? <a className="text-link" href={resource.href} target="_blank" rel="noreferrer">{resource.link}<span aria-hidden="true"> →</span><span className="sr-only"> in a new tab</span></a> : <Link className="text-link" href={resource.href}>{resource.link}<span aria-hidden="true"> →</span></Link>}</article>)}
        </div>
      </section>

      <section className="learning-audiences section-shell" aria-labelledby="audience-title">
        <div className="learning-audiences-heading"><p className="eyebrow">{t("home.audienceEyebrow")}</p><h2 id="audience-title">{t("home.audienceTitle")}</h2><p>{t("home.audienceCopy")}</p></div>
        <div className="learning-audiences-grid">
          {localizedAudiences.map((audience) => <article key={audience.title}><Image src={audience.image} alt="" width={960} height={640} /><div><h3>{audience.title}</h3><p>{audience.copy}</p></div></article>)}
        </div>
      </section>

      <section className="growvelt-video-section section-shell" aria-labelledby="video-title">
        <div className="video-section-heading"><div><p className="eyebrow">{t("home.videoEyebrow")}</p><h2 id="video-title">{t("home.videoTitle")}</h2></div><p>{t("home.videoCopy")}</p></div>
        <div className="growvelt-video-grid">
          {growveltVideos.map((video) => <article key={video.id}><div className="growvelt-video-frame"><iframe src={`https://www.youtube-nocookie.com/embed/${video.id}?rel=0`} title={video.title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div><h3>{video.title}</h3><a className="text-link" href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer">{t("home.watchYoutube")} <span aria-hidden="true">→</span><span className="sr-only"> in a new tab</span></a></article>)}
        </div>
      </section>

      <section className="certificate-panel section-shell" aria-labelledby="certificate-title">
        <div className="certificate-paper"><LearningMark compact /><span>Growvelt Learning</span><strong>{t("home.certificateName")}</strong><small>{t("home.certificateIssued")}</small><div className="certificate-seal">{t("home.certificateVerified")}</div></div>
        <div><p className="eyebrow">{t("home.certificateEyebrow")}</p><h2 id="certificate-title">{t("home.certificateTitle")}</h2><p>{t("home.certificateCopy")}</p><Link href="/dashboard/certificates" className="text-link">{t("home.viewCertificates")} <span aria-hidden="true">→</span></Link></div>
      </section>

      <section className="teach-band section-shell" aria-labelledby="teach-title">
        <div><p className="eyebrow">{t("home.teachEyebrow")}</p><h2 id="teach-title">{t("home.teachTitle")}</h2><p>{t("home.teachCopy")}</p></div>
        <Link className="button button-secondary" href="/teach">{t("public.teach")}</Link>
      </section>

      <section className="career-band section-shell" aria-labelledby="career-title">
        <div><p className="eyebrow">{t("home.careerEyebrow")}</p><h2 id="career-title">{t("home.careerTitle")}</h2><p>{t("home.careerCopy")}</p></div>
        <a className="button button-primary" href={jobsHref} target="_blank" rel="noreferrer">{t("home.exploreCareers")}<span className="sr-only"> in a new tab</span></a>
      </section>

      <section className="growvelt-faq section-shell" aria-labelledby="faq-title">
        <div className="faq-heading"><p className="eyebrow">{t("home.faqEyebrow")}</p><h2 id="faq-title">{t("home.faqTitle")}</h2><p><Link href="/frequently-asked-questions">{t("home.faqBrowse")}</Link> or <Link href="/contact">{t("home.faqContact")}</Link> for something specific.</p></div>
        <div>{localizedQuestions.map((item) => <details key={item.question}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}</div>
      </section>

      <section className="collaboration-band section-shell" aria-labelledby="collaboration-title">
        <div><p className="eyebrow">{t("home.collabEyebrow")}</p><h2 id="collaboration-title">{t("home.collabTitle")}</h2><p>{t("home.collabCopy")}</p></div>
        <div className="hero-actions"><Link className="button button-secondary" href="/partner-with-growvelt">{t("home.partner")}</Link></div>
      </section>

      <section className="final-cta section-shell"><p className="eyebrow">{t("home.finalEyebrow")}</p><h2>{t("home.finalTitle")}</h2><Link className="button button-primary" href="/learn">{t("public.explore")}</Link></section>
    </main>
    <FooterWrapper />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(growveltOrganizationJsonLd) }} />
  </div>;
}
