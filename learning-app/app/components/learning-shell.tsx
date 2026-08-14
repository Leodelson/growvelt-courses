import { LearningShellNavigation } from "@/app/components/learning-shell-navigation";
import { isLearningAdmin } from "@/app/lib/admin/authorization";
import { isApprovedInstructor } from "@/app/lib/instructor/authorization";
import { createClient } from "@/app/lib/supabase/server";

export async function LearningShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const [{ data: { user } }, isInstructor, isAdmin] = await Promise.all([supabase.auth.getUser(), isApprovedInstructor(), isLearningAdmin()]);
  const email = user?.email ?? "Signed-in Growvelt account";
  const displayName = typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null;
  return <LearningShellNavigation isInstructor={isInstructor} isAdmin={isAdmin} userEmail={email} displayName={displayName}>{children}</LearningShellNavigation>;
}
