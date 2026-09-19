import { ApplicationStatusLoader } from "@/app/components/instructor/application-status-loader";
import { ProtectedPageHeader } from "@/app/components/protected-page-header";

export const metadata = { title: "Instructor application" };

export default async function TeachApplicationPage() {
  return <><ProtectedPageHeader context="Instructor application" backHref="/teach" backLabel="Back to Teach on Growvelt" /><main id="main-content" className="instructor-page section-shell"><ApplicationStatusLoader /></main></>;
}
