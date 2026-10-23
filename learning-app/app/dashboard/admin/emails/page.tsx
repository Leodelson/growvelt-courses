import { redirect } from "next/navigation";
import { isLearningAdmin } from "@/app/lib/admin/authorization";
import { LearningEmailCenter } from "./workspace";
import { createClient } from "@/app/lib/supabase/server";
import { isEmailOperator } from "@/app/lib/email/email-center-authorization";
import { learningPath } from "@/app/lib/site-urls.mjs";

export const metadata = { title: "Email Center" };
export const dynamic = "force-dynamic";

export default async function AdminEmailCenterPage() {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!isEmailOperator(user) || !await isLearningAdmin()) redirect(learningPath("/dashboard"));
  return <LearningEmailCenter />;
}
