import { redirect } from "next/navigation";
import { ApplicationStatus } from "@/app/components/instructor/application-status";
import { ProtectedPageHeader } from "@/app/components/protected-page-header";
import { getOwnInstructorApplication } from "@/app/lib/instructor/application";

export const metadata = { title: "Instructor application" };

export default async function TeachApplicationPage() {
  const application = await getOwnInstructorApplication();
  if (application?.approval_status === "approved") redirect("/instructor");
  return <><ProtectedPageHeader context="Instructor application" backHref="/teach" backLabel="Teach on Growvelt" /><main id="main-content" className="instructor-page section-shell"><ApplicationStatus application={application} /></main></>;
}
