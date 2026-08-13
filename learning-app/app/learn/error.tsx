"use client";

import { RouteError } from "@/app/components/ui/route-error";

export default function PublicCatalogError({ reset }: { reset: () => void }) {
  return <RouteError title="Unable to load published courses" description="Try again in a moment. You can still return to the Growvelt Learning home page." reset={reset} recoveryHref="/" recoveryLabel="Learning home" />;
}
