import FooterWrapper from "@/app/components/FooterWrapper";
import { PublicHeader } from "@/app/components/public-header";
import { BlogPageContent } from "@/app/components/blog-page-content";
import { publicPageMetadata } from "@/app/lib/seo";

export const metadata = publicPageMetadata({
  title: "Practical Skills and Learning Articles",
  description: "Read Growvelt articles on online learning, practical skills, data, technology, and career development.",
  path: "/blog",
});

export default function BlogPage() {
  return (
    <div className="public-page blog-page">
      <PublicHeader />
      <BlogPageContent />
      <FooterWrapper />
    </div>
  );
}
