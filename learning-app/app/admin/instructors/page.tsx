import { redirect } from "next/navigation";

export default function LegacyAdminInstructorQueuePage() {
  redirect("/dashboard/admin/instructors");
}
