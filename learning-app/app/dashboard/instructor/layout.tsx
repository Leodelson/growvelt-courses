import { redirect } from "next/navigation";
import { isApprovedInstructor } from "@/app/lib/instructor/authorization";

export default async function DashboardInstructorLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!await isApprovedInstructor()) redirect("/teach/application");
  return children;
}
