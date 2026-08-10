import { CatalogPreview } from "@/app/components/catalog-preview";

export const metadata = { title: "Explore catalog" };

export default function DashboardExplorePage() {
  return <CatalogPreview authenticated />;
}
