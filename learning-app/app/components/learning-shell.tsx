import { LearningShellNavigation } from "@/app/components/learning-shell-navigation";
import { cookies } from "next/headers";
import { isLearningAdmin } from "@/app/lib/admin/authorization";
import { isApprovedInstructor } from "@/app/lib/instructor/authorization";
import { createClient } from "@/app/lib/supabase/server";
import { getOwnLearningProfile } from "@/app/lib/learning-profile";
import { getOwnCompanyWorkspaces } from "@/app/lib/company/workspaces";

export async function LearningShell({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const supabase = await createClient();
  const [{ data: { user } }, isInstructor, isAdmin, profile, companyWorkspaces] = await Promise.all([supabase.auth.getUser(), isApprovedInstructor(), isLearningAdmin(), getOwnLearningProfile(), getOwnCompanyWorkspaces().catch(() => [])]);
  const email = user?.email ?? "Signed-in Growvelt account";
  const displayName = profile?.fullName ?? (typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null);
  const initialSidebarCollapsed = cookieStore.get("growvelt-learning-sidebar-collapsed")?.value === "true";
  const isCompany = companyWorkspaces.some((workspace) => workspace.membership_status === "active" && workspace.workspace_status === "active");
  return <LearningShellNavigation initialSidebarCollapsed={initialSidebarCollapsed} isInstructor={isInstructor} isAdmin={isAdmin} isCompany={isCompany} userEmail={email} displayName={displayName} avatarUrl={profile?.avatarUrl ?? null}>{children}</LearningShellNavigation>;
}
