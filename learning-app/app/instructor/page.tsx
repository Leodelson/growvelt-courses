import { redirect } from "next/navigation";
import { ProtectedPageHeader } from "@/app/components/protected-page-header";
import { isApprovedInstructor } from "@/app/lib/instructor/authorization";

export const metadata = { title: "Instructor workspace" };

export default async function InstructorPage() {
  if (!await isApprovedInstructor()) redirect("/teach/application");
  return <><ProtectedPageHeader context="Instructor workspace" backHref="/dashboard" backLabel="Learning dashboard" /><main id="main-content" className="instructor-page section-shell"><section className="application-status instructor-workspace-status"><p className="eyebrow">Approved Instructor</p><h1>Your teaching workspace is ready.</h1><p>You have approved Instructor access. Course creation and management tools are the next product phase.</p><p className="workspace-note">Your learner dashboard remains available while you prepare to teach.</p></section></main></>;
}
