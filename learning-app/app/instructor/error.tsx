"use client";

import { RouteError } from "@/app/components/ui/route-error";

export default function InstructorError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  void error;
  return <RouteError title="We couldn’t load the Instructor workspace." description="Try again, or return to your Instructor application status." reset={reset} recoveryHref="/teach/application" recoveryLabel="View application status" />;
}
