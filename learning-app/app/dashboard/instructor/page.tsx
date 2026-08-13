import Link from "next/link";

export const metadata = { title: "Instructor workspace" };

export default function DashboardInstructorPage() {
  return <section className="instructor-page section-shell"><section className="application-status instructor-workspace-status"><p className="eyebrow">Approved Instructor</p><h1>Build practical learning that earns trust.</h1><p>Create course drafts, organize text and video lessons, author secure quizzes, and submit complete learning experiences for Growvelt review.</p><div className="instructor-workspace-steps" aria-label="Instructor publishing workflow"><span><strong>01</strong> Create</span><span><strong>02</strong> Build curriculum</span><span><strong>03</strong> Submit for review</span><span><strong>04</strong> Publish</span></div><div className="workspace-actions"><Link className="button button-primary" href="/dashboard/instructor/courses">My Courses</Link><Link className="button button-secondary" href="/dashboard/instructor/courses/new">Create Course</Link></div><p className="workspace-note">Your learner dashboard remains available while you teach on Growvelt.</p></section></section>;
}
