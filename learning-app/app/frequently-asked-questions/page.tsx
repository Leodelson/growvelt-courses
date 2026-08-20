import type { Metadata } from "next";
import FooterWrapper from "@/app/components/FooterWrapper";
import { PublicHeader } from "@/app/components/public-header";
import { FaqPageContent } from "@/app/components/faq-page-content";

export const metadata: Metadata = {
  title: "Frequently Asked Questions | Growvelt Learning and Careers",
  description: "Answers to common Growvelt questions about learning, certificates, teaching, jobs, careers, support, and partnerships.",
  alternates: { canonical: "/frequently-asked-questions" },
  openGraph: { url: "/frequently-asked-questions", title: "Frequently Asked Questions | Growvelt" },
};

export default function FrequentlyAskedQuestionsPage() {
  return <div className="public-page faq-page">
    <PublicHeader />
    <FaqPageContent />
    <FooterWrapper />
  </div>;
}
