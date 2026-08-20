import Link from "next/link";
import type { InstructorApplication } from "@/app/lib/instructor/application";
import { useLanguage } from "@/app/components/language-provider";

export function ApplicationStatus({ application }: { application: InstructorApplication | null }) {
  const { t } = useLanguage();
  if (!application) return <section className="application-status"><p className="eyebrow">{t("teach.application")}</p><h1>{t("teach.ready")}</h1><p>{t("teach.readyCopy")}</p><Link className="button button-primary" href="/teach/apply">{t("teach.apply")}</Link></section>;
  if (application.approval_status === "pending") return <section className="application-status"><p className="eyebrow">{t("teach.pending")}</p><h1>{t("teach.pendingTitle")}</h1><p>{t("teach.pendingCopy")}</p><Link className="button button-secondary" href="/teach">{t("teach.back")}</Link></section>;
  if (application.approval_status === "rejected") return <section className="application-status"><p className="eyebrow">{t("teach.rejected")}</p><h1>{t("teach.rejectedTitle")}</h1><p>{t("teach.rejectedCopy")}</p><Link className="button button-secondary" href="/teach">{t("teach.back")}</Link></section>;
  return <section className="application-status"><p className="eyebrow">{t("teach.approved")}</p><h1>{t("teach.approvedTitle")}</h1><p>{t("teach.approvedCopy")}</p><Link className="button button-primary" href="/dashboard/instructor">{t("teach.workspace")}</Link></section>;
}
