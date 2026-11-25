"use client";

import { usePathname } from "next/navigation";
import { lazy, Suspense } from "react";

const helpPages = new Set(["/contact", "/frequently-asked-questions", "/dashboard/support", "/learning/dashboard/support"]);
const Assistant = lazy(() => import("./learning-help-assistant").then((module) => ({
  default: module.LearningHelpAssistant,
})));

export function SupportPageAssistant() {
  const pathname = usePathname();
  if (!pathname || !helpPages.has(pathname.replace(/\/$/, ""))) return null;

  return <Suspense fallback={null}><Assistant /></Suspense>;
}
