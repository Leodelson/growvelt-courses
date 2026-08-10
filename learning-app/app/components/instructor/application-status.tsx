import Link from "next/link";
import type { InstructorApplication } from "@/app/lib/instructor/application";

export function ApplicationStatus({ application }: { application: InstructorApplication | null }) {
  if (!application) return <section className="application-status"><p className="eyebrow">Instructor application</p><h1>Ready to share practical expertise?</h1><p>You have not started an Instructor application yet.</p><Link className="button button-primary" href="/teach/apply">Apply to teach</Link></section>;
  if (application.approval_status === "pending") return <section className="application-status"><p className="eyebrow">Application under review</p><h1>Thanks for applying to teach.</h1><p>Your application is under review. We’ll make Instructor access available only after approval.</p><Link className="button button-secondary" href="/teach">Back to Teach on Growvelt</Link></section>;
  if (application.approval_status === "rejected") return <section className="application-status"><p className="eyebrow">Application update</p><h1>Thank you for your interest in teaching.</h1><p>Your application was not approved at this time. Reapplication is not available yet.</p><Link className="button button-secondary" href="/teach">Back to Teach on Growvelt</Link></section>;
  return <section className="application-status"><p className="eyebrow">Instructor access active</p><h1>You’re approved to teach on Growvelt.</h1><p>Your Instructor workspace is ready. Course creation tools will arrive in the next phase.</p><Link className="button button-primary" href="/dashboard/instructor">Go to Instructor workspace</Link></section>;
}
