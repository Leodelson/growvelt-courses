import type { CourseStatus } from "@/app/lib/instructor/course-options";

const labels: Record<CourseStatus, string> = {
  draft: "Draft",
  pending_review: "In review",
  published: "Published",
  archived: "Archived",
};

export function CourseStatusBadge({ status }: { status: CourseStatus }) {
  return <span className={`course-status-badge course-status-${status}`}>{labels[status]}</span>;
}
