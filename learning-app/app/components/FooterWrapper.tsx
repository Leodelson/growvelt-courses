"use client";

import Footer from "./Footer";
import { usePathname } from "next/navigation";

export default function FooterWrapper() {
  const pathname = usePathname();

  // Hide footer on auth pages or any others you want
  const hideFooter = pathname.startsWith("/auth") || pathname.startsWith("/dashboard/jobs") || pathname.startsWith("/dashboard/profile") || pathname.startsWith("/dashboard/recruiter/pricing") || pathname.startsWith("/dashboard/pricing") || pathname.startsWith("/dashboard/applications") || pathname.startsWith("/dashboard/settings") || pathname.startsWith("/dashboard/saved") || pathname.startsWith("/dashboard/post-job") || pathname.startsWith("/dashboard/my-jobs") || pathname.startsWith("/dashboard/post-job/preview") || pathname.startsWith("/dashboard/post-job/success") || pathname.startsWith("/dashboard/admin/jobs") || pathname.startsWith("/app/jobs/[id]") || pathname.startsWith("/dashboard/jobs/[id]/apply") || pathname.startsWith("/app/jobs/[id]/apply/questions") || pathname.startsWith("/app/jobs/[id]/apply/preview") || pathname.startsWith("/app/jobs/[id]/apply/success") || pathname.startsWith("/dashboard/my-jobs/jobs/[id]") || pathname.startsWith("/dashboard/jobs/[id]") || pathname.startsWith("/app/post-job/success") || pathname.startsWith("/app/settings") || pathname.startsWith("/dashboard") || pathname.startsWith("/career-assistant/employer") || pathname.startsWith("/career-assistant/job-seeker") || pathname.startsWith("/updates");

  if (hideFooter) return null;

  return <Footer />;
}