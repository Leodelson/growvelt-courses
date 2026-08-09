import Link from "next/link";
import { redirect } from "next/navigation";
import { isApprovedInstructor } from "@/app/lib/instructor/authorization";

export const metadata = { title: "Instructor workspace" };

export default async function InstructorPage() {
  if (!await isApprovedInstructor()) redirect("/teach/application");
  return <main className="instructor-page section-shell"><header className="workspace-header"><p className="eyebrow">Instructor workspace</p><Link className="back-link" href="/dashboard">Learning dashboard</Link></header><section className="application-status"><h1>Instructor access is active.</h1><p>You’re approved to teach on Growvelt. Course creation and review tools are coming in the next phase.</p></section></main>;
}
