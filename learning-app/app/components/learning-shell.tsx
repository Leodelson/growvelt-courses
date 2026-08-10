import { LearningShellNavigation } from "@/app/components/learning-shell-navigation";
import { isLearningAdmin } from "@/app/lib/admin/authorization";
import { isApprovedInstructor } from "@/app/lib/instructor/authorization";

export async function LearningShell({ children }: { children: React.ReactNode }) {
  const [isInstructor, isAdmin] = await Promise.all([isApprovedInstructor(), isLearningAdmin()]);
  return <LearningShellNavigation isInstructor={isInstructor} isAdmin={isAdmin}>{children}</LearningShellNavigation>;
}
