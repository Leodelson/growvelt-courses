import FooterWrapper from "@/app/components/FooterWrapper";
import { PublicHeader } from "@/app/components/public-header";
import { PartnerPageContent } from "@/app/components/partner-page-content";
import { publicPageMetadata } from "@/app/lib/seo";

export const metadata = publicPageMetadata({
  title: "Partner on Skills and Opportunity",
  description: "Work with Growvelt on digital skills, workforce learning, inclusive education, and practical development programmes.",
  path: "/partner-with-growvelt",
});

export default function PartnerWithGrowveltPage() {
  return <div className="public-page partner-page">
    <PublicHeader />
    <PartnerPageContent />
    <FooterWrapper />
  </div>;
}
