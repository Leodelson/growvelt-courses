import Image from "next/image";
import Link from "next/link";
import { Download, Mail } from "lucide-react";
import { NewsletterForm } from "@/app/components/newsletter-form";
import { CookieSettingsButton } from "@/app/components/privacy/cookie-settings-button";

const jobsHref = "https://growvelt.com";

const learningLinks = [
  { label: "Explore courses", href: "/learn" },
  { label: "Growvelt Blog", href: "/blog" },
  { label: "Frequently asked questions", href: "/frequently-asked-questions" },
  { label: "Teach on Growvelt", href: "/teach" },
  { label: "Contact us", href: "/contact" },
  { label: "Partner with Growvelt", href: "/partner-with-growvelt" },
  { label: "My Learning", href: "/dashboard/my-learning" },
  { label: "Certificates", href: "/dashboard/certificates" },
];

const supportLinks = [
  { label: "Instagram support", href: "https://instagram.com/growvelt", iconSrc: "/images/instagram-oip.png" },
  { label: "WhatsApp support", href: "https://wa.me/2349034876746", iconSrc: "/images/whatsapp-r3.png" },
  { label: "Email support", href: "mailto:support@growvelt.com", Icon: Mail },
];

function SocialIcon({ name }: { name: "linkedin" | "instagram" | "facebook" | "tiktok" | "whatsapp" }) {
  if (name === "linkedin") return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6.5 8.5v9M6.5 5.8v.1M10.5 17.5v-5.2a3.3 3.3 0 0 1 6.5 0v5.2M10.5 12.3v-3.8" /></svg>;
  if (name === "instagram") return <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4" /><circle cx="12" cy="12" r="3.5" /><circle cx="17.2" cy="6.9" r=".8" fill="currentColor" stroke="none" /></svg>;
  if (name === "facebook") return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M14 8h3V4h-3c-2.3 0-4 1.7-4 4v2H7v4h3v6h4v-6h3l1-4h-4V8Z" /></svg>;
  if (name === "whatsapp") return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 11.6a8 8 0 0 1-11.8 7L4 20l1.4-4.1A8 8 0 1 1 20 11.6Z" /><path d="M9.1 8.2c.2-.5.4-.5.7-.5h.5c.2 0 .4.1.5.4l.7 1.6c.1.3.1.5 0 .7l-.4.5c-.1.2-.2.3 0 .5.3.6 1 1.5 2.1 2.1.2.1.4.1.6-.1l.5-.6c.2-.2.4-.3.7-.2l1.5.7c.3.1.4.3.4.5v.4c0 .4-.2.8-.6 1-1 .5-3.1.1-5.4-2.1-2.2-2.3-2.6-4.4-2.1-5.4Z" /></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M14.5 4.5v9.2a3.8 3.8 0 1 1-3-3.7" /><path d="M14.5 7.2c1.4 1.4 2.7 2 4.5 2.2" /></svg>;
}

export default function Footer() {
  return (
    <footer className="growvelt-footer">
      <div className="growvelt-footer-main">
        <div className="section-shell">
          <div className="growvelt-footer-feature">
            <div>
              <p className="growvelt-footer-kicker">Growvelt Careers &amp; Learning</p>
              <h2>A home for jobs, career growth, and learning support.</h2>
              <p>Growvelt brings practical learning, career development, employers, and opportunities together in one connected ecosystem.</p>
              <div className="growvelt-footer-actions">
                <Link className="growvelt-footer-button is-light" href="/learn">Explore courses</Link>
                <a className="growvelt-footer-button is-quiet" href={jobsHref} target="_blank" rel="noreferrer">Apply for jobs<span className="sr-only"> in a new tab</span></a>
              </div>
            </div>
            <div className="growvelt-footer-about">
              <div className="growvelt-footer-logo-tile"><Image src="/logo/Growvelt Logo.png" alt="Growvelt" width={400} height={400} priority={false} /></div>
              <p>Growvelt is a technology ecosystem connecting skills development, career intelligence, and employment; helping emerging-market talent move from learning → career readiness → verified skills → employment.</p>
              <Link href="/about">Learn more about Growvelt <span aria-hidden="true">→</span></Link>
            </div>
          </div>

          <div className="growvelt-footer-links">
            <nav aria-label="Growvelt Learning">
              <h3>Growvelt Learning</h3>
              {learningLinks.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
            </nav>
            <nav aria-label="Growvelt Careers">
              <h3>Growvelt Careers</h3>
              <a className="growvelt-career-assistant" href="https://www.growvelt.com/career-assistant" target="_blank" rel="noreferrer">Career Assistant <span aria-hidden="true">→</span></a>
              <a className="growvelt-footer-install" href={jobsHref} target="_blank" rel="noreferrer"><Download aria-hidden="true" />Get the Growvelt App</a>
              <p className="growvelt-footer-group-title">For employers</p>
              <a href={jobsHref} target="_blank" rel="noreferrer">Post a job</a>
              <a href={jobsHref} target="_blank" rel="noreferrer">Manage jobs</a>
              <p className="growvelt-footer-group-title">For job seekers</p>
              <a href={jobsHref} target="_blank" rel="noreferrer">Track applications</a>
              <a href={jobsHref} target="_blank" rel="noreferrer">Jobs</a>
              <a href={jobsHref} target="_blank" rel="noreferrer">Upgrade</a>
            </nav>
            <nav aria-label="Growvelt support">
              <h3>Support</h3>
              {supportLinks.map((link) => <a key={link.href} href={link.href} target={link.href.startsWith("http") ? "_blank" : undefined} rel={link.href.startsWith("http") ? "noreferrer" : undefined}>{link.iconSrc ? <Image className="growvelt-support-image" src={link.iconSrc} alt="" width={24} height={24} /> : <Mail aria-hidden="true" />}{link.label}</a>)}
            </nav>
            <section className="growvelt-footer-newsletter" aria-labelledby="newsletter-title">
              <h3 id="newsletter-title">Newsletter</h3>
              <p>Get updates on jobs, courses, and career development directly in your inbox.</p>
              <NewsletterForm />
              <small id="newsletter-note">We only use your email for Growvelt updates.</small>
              <div className="growvelt-footer-socials" aria-label="Follow Growvelt">
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
          <p>© {new Date().getFullYear()} Growvelt Technologies Limited (RC - 8738218). All rights reserved.</p>
          <nav aria-label="Legal links">
            <Link href="/privacy-policy">Privacy policy</Link>
            <Link href="/terms-of-service">Terms of service</Link>
            <Link href="/cookie-policy">Cookie policy</Link>
            <CookieSettingsButton />
          </nav>
        </div>
      </div>
    </footer>
  );
}
