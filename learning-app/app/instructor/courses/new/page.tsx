import { redirect } from "next/navigation";
import { CourseDraftForm } from "@/app/components/instructor/course-draft-form";
import { ProtectedPageHeader } from "@/app/components/protected-page-header";
import { isApprovedInstructor } from "@/app/lib/instructor/authorization";

export const metadata = { title: "Create course draft" };

export default async function NewInstructorCoursePage() {
  if (!await isApprovedInstructor()) redirect("/teach/application");

  return <><ProtectedPageHeader context="Create course" backHref="/instructor/courses" backLabel="Your courses" /><main id="main-content" className="course-editor-page section-shell"><header className="course-editor-heading"><p className="eyebrow">Private draft</p><h1>Start a course with a clear outcome.</h1><p>This creates a private Instructor-owned draft. It does not submit, publish, or offer the course to learners.</p></header><CourseDraftForm mode="create" /></main></>;
}
