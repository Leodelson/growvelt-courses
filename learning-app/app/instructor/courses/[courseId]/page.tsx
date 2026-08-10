import { redirect } from "next/navigation";

export default async function LegacyInstructorCourseEditorPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  redirect(`/dashboard/instructor/courses/${encodeURIComponent(courseId)}`);
}
