"use client";

import { RouteError } from "@/app/components/ui/route-error";

export default function TeachError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  void error;
  return <RouteError title="We couldn’t load this teaching step." description="Please try again. If the problem continues, return to Teach on Growvelt and start from there." reset={reset} recoveryHref="/teach" recoveryLabel="Teach on Growvelt" />;
}
