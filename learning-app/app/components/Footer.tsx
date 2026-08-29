"use client";

import Image from "next/image";
import Link from "next/link";
import { Download, Mail } from "lucide-react";
import { NewsletterForm } from "@/app/components/newsletter-form";
import { CookieSettingsButton } from "@/app/components/privacy/cookie-settings-button";
import { useLanguage } from "@/app/components/language-provider";

const jobsHref = "https://growvelt.com";

function SocialIcon({ name }: { name: "linkedin" | "instagram" | "facebook" | "tiktok" | "whatsapp" }) {
  if (name === "linkedin") return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6.5 8.5v9M6.5 5.8v.1M10.5 17.5v-5.2a3.3 3.3 0 0 1 6.5 0v5.2M10.5 12.3v-3.8" /></svg>;
  if (name === "instagram") return <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4" /><circle cx="12" cy="12" r="3.5" /><circle cx="17.2" cy="6.9" r=".8" fill="currentColor" stroke="none" /></svg>;
  if (name === "facebook") return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M14 8h3V4h-3c-2.3 0-4 1.7-4 4v2H7v4h3v6h4v-6h3l1-4h-4V8Z" /></svg>;
  if (name === "whatsapp") return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 11.6a8 8 0 0 1-11.8 7L4 20l1.4-4.1A8 8 0 1 1 20 11.6Z" /><path d="M9.1 8.2c.2-.5.4-.5.7-.5h.5c.2 0 .4.1.5.4l.7 1.6c.1.3.1.5 0 .7l-.4.5c-.1.2-.2.3 0 .5.3.6 1 1.5 2.1 2.1.2.1.4.1.6-.1l.5-.6c.2-.2.4-.3.7-.2l1.5.7c.3.1.4.3.4.5v.4c0 .4-.2.8-.6 1-1 .5-3.1.1-5.4-2.1-2.2-2.3-2.6-4.4-2.1-5.4Z" /></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M14.5 4.5v9.2a3.8 3.8 0 1 1-3-3.7" /><path d="M14.5 7.2c1.4 1.4 2.7 2 4.5 2.2" /></svg>;
}

export default function Footer() {
  const { t } = useLanguage();
  const learningLinks = [
    { label: t("footer.explore"), href: "/learn" }, { label: t("footer.blog"), href: "/blog" }, { label: t("footer.faq"), href: "/frequently-asked-questions" }, { label: t("public.teach"), href: "/teach" }, { label: t("footer.contact"), href: "/contact" }, { label: t("footer.partner"), href: "/partner-with-growvelt" }, { label: t("footer.myLearning"), href: "/dashboard/my-learning" }, { label: t("footer.certificates"), href: "/dashboard/certificates" },
  ];
  const supportLinks = [
    { label: t("footer.instagramSupport"), href: "https://instagram.com/growvelt", iconSrc: "/images/instagram-oip.png" }, { label: t("footer.whatsappSupport"), href: "https://wa.me/2349034876746", iconSrc: "/images/whatsapp-r3.png" }, { label: t("footer.emailSupport"), href: "mailto:support@growvelt.com", Icon: Mail },
  ];
  return (
    <footer className="growvelt-footer">
      <div className="growvelt-footer-main">
        <div className="section-shell">
          <div className="growvelt-footer-feature">
            <div>
              <p className="growvelt-footer-kicker">{t("footer.kicker")}</p>
              <h2>{t("footer.title")}</h2>
              <p>{t("footer.copy")}</p>
              <div className="growvelt-footer-actions">
                <Link className="growvelt-footer-button is-light" href="/learn">{t("footer.explore")}</Link>
                <a className="growvelt-footer-button is-quiet" href={jobsHref} target="_blank" rel="noreferrer">{t("footer.applyJobs")}<span className="sr-only"> in a new tab</span></a>
              </div>
            </div>
            <div className="growvelt-footer-about">
              <div className="growvelt-footer-logo-tile"><Image src="/logo/Growvelt Logo.png" alt="Growvelt" width={400} height={400} priority={false} /></div>
              <p>{t("footer.about")}</p>
              <Link href="/about">{t("footer.learnMore")} <span aria-hidden="true">→</span></Link>
            </div>
          </div>

          <div className="growvelt-footer-links">
            <nav aria-label={t("footer.learning")}>
              <h3>{t("footer.learning")}</h3>
              {learningLinks.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
            </nav>
            <nav aria-label={t("footer.careers")}>
              <h3>{t("footer.careers")}</h3>
              <a className="growvelt-career-assistant" href="https://www.growvelt.com/career-assistant" target="_blank" rel="noreferrer">{t("footer.careerAssistant")} <span aria-hidden="true">→</span></a>
              <a className="growvelt-footer-install" href={jobsHref} target="_blank" rel="noreferrer"><Download aria-hidden="true" />{t("footer.getApp")}</a>
              <p className="growvelt-footer-group-title">{t("footer.employers")}</p>
              <a href={jobsHref} target="_blank" rel="noreferrer">{t("footer.postJob")}</a>
              <a href={jobsHref} target="_blank" rel="noreferrer">{t("footer.manageJobs")}</a>
              <p className="growvelt-footer-group-title">{t("footer.jobSeekers")}</p>
              <a href={jobsHref} target="_blank" rel="noreferrer">{t("footer.trackApplications")}</a>
              <a href={jobsHref} target="_blank" rel="noreferrer">{t("footer.jobs")}</a>
              <a href={jobsHref} target="_blank" rel="noreferrer">{t("footer.upgrade")}</a>
            </nav>
            <nav aria-label={t("footer.support")}>
              <h3>{t("footer.support")}</h3>
              {supportLinks.map((link) => <a key={link.href} href={link.href} target={link.href.startsWith("http") ? "_blank" : undefined} rel={link.href.startsWith("http") ? "noreferrer" : undefined}>{link.iconSrc ? <Image className="growvelt-support-image" src={link.iconSrc} alt="" width={24} height={24} /> : <Mail aria-hidden="true" />}{link.label}</a>)}
            </nav>
            <section className="growvelt-footer-newsletter" aria-labelledby="newsletter-title">
              <h3 id="newsletter-title">{t("footer.newsletter")}</h3>
              <p>{t("footer.newsletterCopy")}</p>
              <NewsletterForm />
              <small id="newsletter-note">{t("footer.newsletterNote")}</small>
              <div className="growvelt-footer-socials" aria-label={t("footer.follow")}>
                <a href="https://www.linkedin.com/company/growvelt" target="_blank" rel="noreferrer"><SocialIcon name="linkedin" />LinkedIn</a>
                <a href="https://instagram.com/growvelt" target="_blank" rel="noreferrer"><SocialIcon name="instagram" />Instagram</a>
                <a href="https://web.facebook.com/growvelttechnologies09" target="_blank" rel="noreferrer"><SocialIcon name="facebook" />Facebook</a>
                <a href="https://www.tiktok.com/@growvelt" target="_blank" rel="noreferrer"><SocialIcon name="tiktok" />TikTok</a>
              </div>
            </section>
          </div>
        </div>
      </div>
      <div className="growvelt-footer-legal">
        <div className="section-shell">
          <p>© {new Date().getFullYear()} Growvelt Technologies Limited (RC - 8738218). {t("footer.rights")}</p>
          <nav aria-label="Legal links">
            <Link href="/privacy-policy">{t("footer.privacy")}</Link>
            <Link href="/terms-of-service">{t("footer.terms")}</Link>
            <Link href="/refund-policy">Refund policy</Link>
            <Link href="/cookie-policy">{t("footer.cookies")}</Link>
            <CookieSettingsButton />
          </nav>
        </div>
      </div>
    </footer>
  );
}
