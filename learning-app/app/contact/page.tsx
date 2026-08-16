import type { Metadata } from "next";
import { Clock3, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import FooterWrapper from "@/app/components/FooterWrapper";
import { PublicHeader } from "@/app/components/public-header";
import { PublicInquiryForm } from "@/app/components/public-inquiry-form";

export const metadata: Metadata = {
  title: "Contact us | Learning and support",
  description: "Contact us for course questions, learner support, teaching enquiries, jobs, career tools, or partnership conversations.",
  alternates: { canonical: "/contact" },
  openGraph: { url: "/contact", title: "Contact us | Learning and support" },
};

const channels = [
  { title: "Email support", description: "Questions about courses, learning, or your Growvelt account.", href: "mailto:support@growvelt.com", label: "support@growvelt.com", Icon: Mail },
  { title: "WhatsApp support", description: "Message the Growvelt team directly for practical support.", href: "https://wa.me/2349034876746", label: "Message on WhatsApp", Icon: MessageCircle },
  { title: "Call Growvelt", description: "Available Monday to Friday, 9:00 AM-5:00 PM WAT.", href: "tel:+2349034876746", label: "+234 903 487 6746", Icon: Phone },
];

export default function ContactPage() {
  return <div className="public-page contact-page">
    <PublicHeader />
    <main>
      <section className="contact-hero section-shell" aria-labelledby="contact-title">
        <div>
          <p className="eyebrow">Contact us</p>
          <h1 id="contact-title">Let’s make your next learning step clearer.</h1>
          <p>Reach out about a course, learner support, teaching with Growvelt, a job or career question, or a partnership idea. Use the form or choose the support channel that works best for you.</p>
        </div>
        <aside>
          <MapPin aria-hidden="true" />
          <strong>Growvelt Learning support</strong>
          <span>Abuja, Nigeria · Serving learners online</span>
          <small><Clock3 aria-hidden="true" /> Monday-Friday, 9:00 AM-5:00 PM WAT</small>
        </aside>
      </section>

      <section className="section-shell contact-channel-grid" aria-label="Direct contact channels">
        {channels.map(({ title, description, href, label, Icon }) => <article key={title}>
          <Icon aria-hidden="true" />
          <h2>{title}</h2>
          <p>{description}</p>
          <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined}>{label}<span className="sr-only">{href.startsWith("http") ? " in a new tab" : ""}</span></a>
        </article>)}
      </section>

      <div className="section-shell"><PublicInquiryForm kind="contact" /></div>
    </main>
    <FooterWrapper />
  </div>;
}
