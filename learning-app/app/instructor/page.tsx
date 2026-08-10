import { redirect } from "next/navigation";
import Link from "next/link";
import { ProtectedPageHeader } from "@/app/components/protected-page-header";
import { isApprovedInstructor } from "@/app/lib/instructor/authorization";

export const metadata = { title: "Instructor workspace" };

export default async function InstructorPage() {
  if (!await isApprovedInstructor()) redirect("/teach/application");
  return <><ProtectedPageHeader context="Instructor workspace" backHref="/dashboard" backLabel="Learning dashboard" /><main id="main-content" className="instructor-page section-shell"><section className="application-status instructor-workspace-status"><p className="eyebrow">Approved Instructor</p><h1>Your teaching workspace is ready.</h1><p>Create and refine private course drafts. Curriculum, review, and publishing remain separate protected phases.</p><div className="workspace-actions"><Link className="button button-primary" href="/instructor/courses">My Courses</Link><Link className="button button-secondary" href="/instructor/courses/new">Create Course</Link></div><p className="workspace-note">Your learner dashboard remains available while you prepare to teach.</p></section></main></>;
}
