"use client";

import type { CourseStatus } from "@/app/lib/instructor/course-options";
import { useLanguage } from "@/app/components/language-provider";

const labels: Record<CourseStatus, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  published: "Published",
  archived: "Archived",
};

export function CourseStatusBadge({ status }: { status: CourseStatus }) {
  const { locale } = useLanguage();
  const localized = locale === "fr" ? { draft: "Brouillon", pending_review: "En attente", published: "Publié", archived: "Archivé" } : locale === "es" ? { draft: "Borrador", pending_review: "En revisión", published: "Publicado", archived: "Archivado" } : labels;
  return <span className={`course-status-badge course-status-${status}`}>{localized[status]}</span>;
}
