import Link from "next/link";

export const metadata = { title: "Admin Operations" };

export default function DashboardAdminPage() {
  return <section className="admin-page section-shell"><header className="admin-page-header"><p className="eyebrow">Admin Operations</p><h1>Operational tools for Growvelt Learning.</h1><p>Review Instructor applications using the protected workflow. Course review will be added in a later product phase.</p></header><section className="admin-empty-state"><p className="eyebrow">Available now</p><h2>Instructor applications</h2><p>Review pending applications and grant teaching capability only through the atomic database decision.</p><Link className="button button-primary" href="/dashboard/admin/instructors">Open Instructor applications</Link></section><section className="course-editor-next"><p className="eyebrow">Coming later</p><h2>Course reviews</h2><p>Course moderation is not available until the curriculum and course-submission checkpoints are complete.</p></section></section>;
}
