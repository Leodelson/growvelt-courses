"use client";

import { RouteError } from "@/app/components/ui/route-error";

export default function AdminInstructorError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  void error;
  return <RouteError title="We couldn’t load Instructor applications." description="Try again, or return to the Learning dashboard." reset={reset} recoveryHref="/dashboard" recoveryLabel="Learning dashboard" />;
}
