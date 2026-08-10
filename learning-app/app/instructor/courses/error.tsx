"use client";

import { RouteError } from "@/app/components/ui/route-error";

export default function InstructorCoursesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  void error;
  return <RouteError title="We couldn’t load your courses." description="Try again, or return to the Instructor workspace." reset={reset} recoveryHref="/instructor" recoveryLabel="Instructor workspace" />;
}
