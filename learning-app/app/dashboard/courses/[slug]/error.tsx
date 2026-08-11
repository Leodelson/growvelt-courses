"use client";

import { RouteError } from "@/app/components/ui/route-error";

export default function PublishedCourseError({ reset }: { reset: () => void }) {
  return <RouteError title="Unable to load this course" description="Try again, or return to the published catalog." reset={reset} recoveryHref="/dashboard/explore" recoveryLabel="Explore catalog" />;
}
