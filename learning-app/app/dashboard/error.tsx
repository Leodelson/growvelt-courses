"use client";

import { RouteError } from "@/app/components/ui/route-error";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError title="Unable to load your learning overview" description="Your learning data is safe. Please try loading the dashboard again." reset={reset} recoveryHref="/dashboard/my-learning" recoveryLabel="Open My Learning" />;
}
