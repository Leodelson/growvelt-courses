import type { MockProgressCourse } from "@/app/lib/mock-data";

export function ProgressCard({ course }: { course: MockProgressCourse }) {
  return <article className="progress-card"><div className={`mini-visual mini-${course.visual}`}><span>{course.shortLabel}</span></div><div><p>{course.category}</p><h3>{course.title}</h3><span className="progress-label">{course.nextLesson}</span><div className="progress-track" aria-label={`${course.progress}% complete`}><span style={{ width: `${course.progress}%` }} /></div><small>{course.progress}% complete</small></div></article>;
}
