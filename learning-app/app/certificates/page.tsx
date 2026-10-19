import type { Metadata } from "next";
import Link from "@/app/components/learning-link";
import FooterWrapper from "@/app/components/FooterWrapper";
import { PublicHeader } from "@/app/components/public-header";
import { LearningMark } from "@/app/components/learning-mark";
import styles from "@/app/components/public/secondary-pages.module.css";

export const metadata: Metadata = { title: "Certificates", robots: { index: false, follow: false } };

export default function CertificatesPage() {
  return <div className="public-page"><PublicHeader /><main id="public-main" className={styles.page}>
    <section className={`section-shell ${styles.hero}`}><div className={styles.intro}><p className="eyebrow">Your learning record</p><h1>Make your achievement part of your story.</h1><p>Complete an eligible course, issue your certificate from its completed course page, and share a link others can verify.</p><div className="hero-actions"><Link className="button button-primary" href="/dashboard/certificates">Open my certificates</Link><Link className="button button-secondary" href="/learn">Explore courses</Link></div><p className={styles.note}>Certificates record eligible course completion. They do not guarantee employment or an external professional certification.</p></div>
      <aside className={styles.certificateSample} aria-label="Illustration of a course completion record"><LearningMark compact /><p className="eyebrow">Course completion</p><h2>Your work.<br />Your achievement.</h2><hr /><p>Complete the required activities.<br />Keep a verifiable record.</p><small>Illustration only. This is not an issued certificate.</small></aside>
    </section>
    <section className={`section-shell ${styles.section}`} aria-labelledby="certificate-steps"><header><p className="eyebrow">How it works</p><h2 id="certificate-steps">From your final lesson to a shareable record.</h2></header><ol className={styles.cards}>
      <li><span className={styles.number}>01</span><h3>Complete your course</h3><p>Finish its required learning activities and satisfy the course’s completion requirements.</p></li>
      <li><span className={styles.number}>02</span><h3>Issue your certificate</h3><p>Open the completed course page to check eligibility and issue the certificate. Find issued records in your certificate library.</p></li>
      <li><span className={styles.number}>03</span><h3>Share and verify</h3><p>Download or print an issued certificate. Its verification link and QR code let others check the public record and its current validity.</p></li>
    </ol></section>
    <section className={`section-shell ${styles.section}`} aria-labelledby="certificate-help"><header><p className="eyebrow">Certificate essentials</p><h2 id="certificate-help">Know what your record represents.</h2></header><div className={styles.questions}><details><summary>Does finishing a course automatically issue a certificate?</summary><p>Completion and issuance are separate steps. Open the completed course to check eligibility and issue your certificate.</p></details><details><summary>How does someone verify my certificate?</summary><p>Share the verification link from your certificate library or the QR code on your certificate. The verification page displays the public record and whether it is valid or revoked.</p></details><details><summary>Need help with a certificate?</summary><p><Link href="/contact">Contact Growvelt support</Link> with the certificate reference.</p></details></div></section>
  </main><FooterWrapper /></div>;
}
