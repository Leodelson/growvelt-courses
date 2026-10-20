import { redirect } from "next/navigation";
import { isLearningAdmin } from "@/app/lib/admin/authorization";
import { LearningEmailCenter } from "./workspace";

export const metadata = { title: "Email Center" };
export const dynamic = "force-dynamic";

export default async function AdminEmailCenterPage() {
  if (!await isLearningAdmin()) redirect("/dashboard");
  return <LearningEmailCenter />;
}
