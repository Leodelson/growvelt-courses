"use client";

import { RouteError } from "@/app/components/ui/route-error";

export default function EnrolledCourseError({ reset }: { reset: () => void }) {
  return <RouteError title="Unable to load this enrolled course" description="Try again, or return to your enrolled courses." reset={reset} recoveryHref="/dashboard/my-learning" recoveryLabel="My Learning" />;
}
