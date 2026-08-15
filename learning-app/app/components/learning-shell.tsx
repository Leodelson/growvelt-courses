import { LearningShellNavigation } from "@/app/components/learning-shell-navigation";
import { isLearningAdmin } from "@/app/lib/admin/authorization";
import { isApprovedInstructor } from "@/app/lib/instructor/authorization";
import { createClient } from "@/app/lib/supabase/server";
import { getOwnLearningProfile } from "@/app/lib/learning-profile";

export async function LearningShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const [{ data: { user } }, isInstructor, isAdmin, profile] = await Promise.all([supabase.auth.getUser(), isApprovedInstructor(), isLearningAdmin(), getOwnLearningProfile()]);
  const email = user?.email ?? "Signed-in Growvelt account";
  const displayName = profile?.fullName ?? (typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null);
  return <LearningShellNavigation isInstructor={isInstructor} isAdmin={isAdmin} userEmail={email} displayName={displayName} avatarUrl={profile?.avatarUrl ?? null}>{children}</LearningShellNavigation>;
}
