import type { Metadata } from "next";
import FooterWrapper from "@/app/components/FooterWrapper";
import { PublicHeader } from "@/app/components/public-header";
import { ContactPageContent } from "@/app/components/contact-page-content";

export const metadata: Metadata = {
  title: "Contact us | Learning and support",
  description: "Contact us for course questions, learner support, teaching enquiries, jobs, career tools, or partnership conversations.",
  alternates: { canonical: "/contact" },
  openGraph: { url: "/contact", title: "Contact us | Learning and support" },
};

export default function ContactPage() {
  return <div className="public-page contact-page">
    <PublicHeader />
    <ContactPageContent />
    <FooterWrapper />
  </div>;
}
