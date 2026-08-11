"use client";

import { RouteError } from "@/app/components/ui/route-error";

export default function AdminCoursesError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError title="We couldn’t load course reviews" description="Try again. If the issue continues, return to Admin Operations." recoveryHref="/dashboard/admin" recoveryLabel="Admin Operations" reset={reset} />;
}
