import type { Metadata } from "next";
import FooterWrapper from "@/app/components/FooterWrapper";
import { PublicHeader } from "@/app/components/public-header";
import { PartnerPageContent } from "@/app/components/partner-page-content";

export const metadata: Metadata = {
  title: "Partner with Growvelt | Digital skills and opportunity",
  description: "Partner with Growvelt on practical learning, workforce development, jobs, career opportunity, and digital-inclusion initiatives.",
  alternates: { canonical: "/partner-with-growvelt" },
  openGraph: { url: "/partner-with-growvelt", title: "Partner with Growvelt | Digital skills and opportunity" },
};

export default function PartnerWithGrowveltPage() {
  return <div className="public-page partner-page">
    <PublicHeader />
    <PartnerPageContent />
    <FooterWrapper />
  </div>;
}
