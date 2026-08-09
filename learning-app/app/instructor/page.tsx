import { redirect } from "next/navigation";
import { isApprovedInstructor } from "@/app/lib/instructor/authorization";

export const metadata = { title: "Instructor workspace" };
export default async function InstructorPage() { if (!await isApprovedInstructor()) redirect("/teach/application"); return <main className="instructor-page section-shell"><section className="application-status"><p className="eyebrow">Instructor workspace</p><h1>Instructor access is active.</h1><p>You’re approved to teach on Growvelt. Course creation and review tools are coming in the next phase.</p></section></main>; }
