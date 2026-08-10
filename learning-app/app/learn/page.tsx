import { CatalogPreview } from "@/app/components/catalog-preview";
import { PublicHeader } from "@/app/components/public-header";

export const metadata = { title: "Explore" };

export default function LearnPage() {
  return <div className="public-page"><PublicHeader /><main><CatalogPreview /></main></div>;
}
