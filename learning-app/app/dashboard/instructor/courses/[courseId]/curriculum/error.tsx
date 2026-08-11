"use client";

import { RouteError } from "@/app/components/ui/route-error";

export default function CurriculumError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError title="We couldn’t load this curriculum" description="Try again. If the course is no longer available to this Instructor account, return to your courses." recoveryHref="/dashboard/instructor/courses" recoveryLabel="My courses" reset={reset} />;
}
