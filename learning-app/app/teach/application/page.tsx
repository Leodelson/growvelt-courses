import Link from "next/link";
import { redirect } from "next/navigation";
import { ApplicationStatus } from "@/app/components/instructor/application-status";
import { getOwnInstructorApplication } from "@/app/lib/instructor/application";

export const metadata = { title: "Instructor application" };

export default async function TeachApplicationPage() {
  const application = await getOwnInstructorApplication();
  if (application?.approval_status === "approved") redirect("/instructor");
  return <main className="instructor-page section-shell"><Link className="back-link" href="/teach">← Teach on Growvelt</Link><ApplicationStatus application={application} /></main>;
}
