import { redirect } from "next/navigation";
import { ApplicationStatus } from "@/app/components/instructor/application-status";
import { ProtectedPageHeader } from "@/app/components/protected-page-header";
import { getOwnInstructorApplication } from "@/app/lib/instructor/application";
import { getRequestLocale } from "@/app/lib/i18n-server";
import { translate } from "@/app/lib/i18n";

export const metadata = { title: "Instructor application" };

export default async function TeachApplicationPage() {
  const [application, locale] = await Promise.all([getOwnInstructorApplication(), getRequestLocale()]);
  if (application?.approval_status === "approved") redirect("/dashboard/instructor");
  return <><ProtectedPageHeader context={translate(locale, "teach.application")} backHref="/teach" backLabel={translate(locale, "teach.back")} /><main id="main-content" className="instructor-page section-shell"><ApplicationStatus application={application} /></main></>;
}
