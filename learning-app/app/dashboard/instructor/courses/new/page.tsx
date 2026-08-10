import { CourseDraftForm } from "@/app/components/instructor/course-draft-form";

export const metadata = { title: "Create course draft" };

export default function DashboardNewInstructorCoursePage() {
  return <section className="course-editor-page section-shell"><header className="course-editor-heading"><p className="eyebrow">Private draft</p><h1>Start a course with a clear outcome.</h1><p>This creates a private Instructor-owned draft. It does not submit, publish, or offer the course to learners.</p></header><CourseDraftForm mode="create" /></section>;
}
