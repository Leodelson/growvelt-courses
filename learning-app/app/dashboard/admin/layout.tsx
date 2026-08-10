import { redirect } from "next/navigation";
import { isLearningAdmin } from "@/app/lib/admin/authorization";

export default async function DashboardAdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!await isLearningAdmin()) redirect("/dashboard");
  return children;
}
