import { redirect } from "next/navigation";
export default function LegacyNewInstructorCoursePage() {
  redirect("/dashboard/instructor/courses/new");
}
