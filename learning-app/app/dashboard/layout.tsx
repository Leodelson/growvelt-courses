import type { Metadata } from "next";
import { LearningShell } from "@/app/components/learning-shell";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <LearningShell>{children}</LearningShell>;
}
