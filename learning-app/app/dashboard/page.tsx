import Link from "next/link";
import { EmptyState } from "@/app/components/empty-state";
import { ProgressCard } from "@/app/components/progress-card";
import { mockDashboardLearning } from "@/app/lib/mock-data";

export const metadata = { title: "Overview" };

export default function DashboardPage() {
  const learning = mockDashboardLearning;
  return <><header className="dashboard-intro"><div><p className="eyebrow">Learning overview</p><h1>Keep moving with purpose.</h1><p>This dashboard uses local demonstration data only. Authentication and saved learning are not connected in Phase 1A.</p></div><Link className="button button-primary" href="/learn">Explore courses</Link></header><section className="continue-card" aria-labelledby="continue-title"><div><p className="eyebrow">Continue learning</p><h2 id="continue-title">{learning.currentCourse.title}</h2><p>{learning.currentCourse.nextLesson}</p><div className="progress-track" aria-label={`${learning.currentCourse.progress}% complete`}><span style={{ width: `${learning.currentCourse.progress}%` }} /></div><small>{learning.currentCourse.progress}% complete</small></div><Link className="button button-secondary" href="/learn">Browse demo courses</Link></section><section id="my-learning" className="dashboard-section" aria-labelledby="progress-title"><div className="section-heading"><div><p className="eyebrow">My Learning</p><h2 id="progress-title">A clear view of your momentum.</h2></div></div><div className="progress-grid">{learning.courses.map((course) => <ProgressCard course={course} key={course.title} />)}</div></section><section className="dashboard-section milestone-grid"><article className="milestone-card"><p className="eyebrow">Next practical milestone</p><h2>{learning.milestone.title}</h2><p>{learning.milestone.description}</p><span className="milestone-tag">Demo learning plan</span></article><EmptyState title="Your proof space is ready" description="Certificates and verified completion will appear here when those product systems are implemented." actionLabel="Explore certificate space" actionHref="/certificates" /></section></>;
}
