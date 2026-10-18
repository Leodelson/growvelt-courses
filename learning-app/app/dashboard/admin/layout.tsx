import { learningPath } from "@/app/lib/site-urls.mjs";
import { redirect } from "next/navigation";
import { isLearningAdmin } from "@/app/lib/admin/authorization";

export default async function DashboardAdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!await isLearningAdmin()) redirect(learningPath("/dashboard"));
  return children;
}
