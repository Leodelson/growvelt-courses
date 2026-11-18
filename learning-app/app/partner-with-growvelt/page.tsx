import FooterWrapper from "@/app/components/FooterWrapper";
import { PublicHeader } from "@/app/components/public-header";
import { PartnerPageContent } from "@/app/components/partner-page-content";
import { publicPageMetadata } from "@/app/lib/seo";

export const metadata = publicPageMetadata({
  title: "Partner with Growvelt",
  description: "Partner with Growvelt on practical digital-skills programmes, workforce learning, inclusive education, and community opportunities.",
  path: "/partner-with-growvelt",
});

export default function PartnerWithGrowveltPage() {
  return <div className="public-page partner-page">
    <PublicHeader />
    <PartnerPageContent />
    <FooterWrapper />
  </div>;
}
