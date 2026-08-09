import type { MockCourse } from "@/app/lib/mock-data";

export function CourseCard({ course }: { course: MockCourse }) {
  return <article className="course-card">
    <div className={`course-visual course-visual-${course.visual}`} aria-hidden="true">
      <span className="course-visual-index">{course.visualLabel}</span>
      <span className="course-visual-word">{course.category}</span>
      <span className="course-visual-grid" />
      <span className="course-visual-shape course-visual-shape-one" />
      <span className="course-visual-shape course-visual-shape-two" />
    </div>
    <div className="course-card-body">
      <div className="course-meta"><span>{course.category}</span><span>{course.level}</span></div>
      <h3>{course.title}</h3><p>{course.outcome}</p>
      <div className="course-details"><span>{course.duration}</span><span>{course.proof}</span></div>
      <div className="course-card-footer"><strong>{course.price}</strong><span className="course-card-preview">Course details coming later</span></div>
    </div>
  </article>;
}
