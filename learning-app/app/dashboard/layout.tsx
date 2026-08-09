import { LearningShell } from "@/app/components/learning-shell";

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <LearningShell>{children}</LearningShell>;
}
