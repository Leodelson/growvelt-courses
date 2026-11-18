import FooterWrapper from "@/app/components/FooterWrapper";
import { PublicHeader } from "@/app/components/public-header";
import { ContactPageContent } from "@/app/components/contact-page-content";
import { publicPageMetadata } from "@/app/lib/seo";

export const metadata = publicPageMetadata({
  title: "Learning Platform Support",
  description: "Get help with Growvelt courses, learner accounts, instructor applications, company training, technical issues, or partnership enquiries.",
  path: "/contact",
});

export default function ContactPage() {
  return <div className="public-page contact-page">
    <PublicHeader />
    <ContactPageContent />
    <FooterWrapper />
  </div>;
}
