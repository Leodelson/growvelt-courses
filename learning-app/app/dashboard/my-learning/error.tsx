"use client";

import { RouteError } from "@/app/components/ui/route-error";

export default function MyLearningError({ reset }: { reset: () => void }) {
  return <RouteError title="Unable to load My Learning" description="Try again, or browse the published course catalog." reset={reset} recoveryHref="/dashboard/explore" recoveryLabel="Explore catalog" />;
}
