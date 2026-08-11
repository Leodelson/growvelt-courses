"use client";

import { RouteError } from "@/app/components/ui/route-error";

export default function PublishedCatalogError({ reset }: { reset: () => void }) {
  return <RouteError title="Unable to load published courses" description="Try again in a moment. Your dashboard is still available." reset={reset} recoveryHref="/dashboard" recoveryLabel="Learning dashboard" />;
}
