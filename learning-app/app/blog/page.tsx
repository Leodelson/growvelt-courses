import type { Metadata } from "next";
import FooterWrapper from "@/app/components/FooterWrapper";
import { PublicHeader } from "@/app/components/public-header";
import { BlogPageContent } from "@/app/components/blog-page-content";

export const metadata: Metadata = {
  title: "Growvelt Blog | Learning, careers, and practical skills",
  description: "Practical articles from Growvelt on learning, careers, data, technology, and turning skills into opportunity.",
  alternates: { canonical: "/blog" },
  openGraph: { url: "/blog", title: "Growvelt Blog | Learning, careers, and practical skills" },
};

export default function BlogPage() {
  return (
    <div className="public-page blog-page">
      <PublicHeader />
      <BlogPageContent />
      <FooterWrapper />
    </div>
  );
}
