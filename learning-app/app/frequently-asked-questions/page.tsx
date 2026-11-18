import FooterWrapper from "@/app/components/FooterWrapper";
import { PublicHeader } from "@/app/components/public-header";
import { FaqPageContent } from "@/app/components/faq-page-content";
import { publicPageMetadata } from "@/app/lib/seo";

export const metadata = publicPageMetadata({
  title: "Courses, Certificates, and Learning FAQs",
  description: "Find answers about Growvelt courses, learner accounts, certificates, teaching, company training, support, and partnerships.",
  path: "/frequently-asked-questions",
});

export default function FrequentlyAskedQuestionsPage() {
  return <div className="public-page faq-page">
    <PublicHeader />
    <FaqPageContent />
    <FooterWrapper />
  </div>;
}
