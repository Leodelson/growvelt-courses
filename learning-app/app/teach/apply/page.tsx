import Link from "next/link";
import { redirect } from "next/navigation";
import { InstructorApplicationForm } from "@/app/components/instructor/application-form";
import { getOwnInstructorApplication } from "@/app/lib/instructor/application";

export const metadata = { title: "Apply to teach" };

export default async function TeachApplyPage() {
  const application = await getOwnInstructorApplication();
  if (application) redirect("/teach/application");
  return <main className="instructor-page section-shell"><Link className="back-link" href="/teach">← Teach on Growvelt</Link><div className="instructor-page-intro"><p className="eyebrow">Teach on Growvelt</p><h1>Apply to become a Growvelt Instructor.</h1><p>Tell us about the practical expertise and thoughtful learning experience you can bring to Growvelt learners.</p></div><InstructorApplicationForm /></main>;
}
