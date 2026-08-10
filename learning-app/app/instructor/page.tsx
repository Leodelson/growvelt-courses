import { redirect } from "next/navigation";

export default function LegacyInstructorPage() {
  redirect("/dashboard/instructor");
}
