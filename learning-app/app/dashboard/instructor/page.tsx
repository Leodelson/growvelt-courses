import Link from "next/link";

export const metadata = { title: "Instructor workspace" };

export default function DashboardInstructorPage() {
  return <section className="instructor-page section-shell"><section className="application-status instructor-workspace-status"><p className="eyebrow">Approved Instructor</p><h1>Your teaching workspace is ready.</h1><p>Create and refine private course drafts. Curriculum, review, and publishing remain separate protected phases.</p><div className="workspace-actions"><Link className="button button-primary" href="/dashboard/instructor/courses">My Courses</Link><Link className="button button-secondary" href="/dashboard/instructor/courses/new">Create Course</Link></div><p className="workspace-note">Your learner dashboard remains available while you prepare to teach.</p></section></section>;
}
