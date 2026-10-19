"use client";

import { RouteError } from "@/app/components/ui/route-error";

export default function VerificationError({ reset }: { reset: () => void }) {
  return <RouteError title="Certificate verification is unavailable" description="We could not check this record right now. Please try again to confirm its status." reset={reset} recoveryHref="/certificates" recoveryLabel="About certificates" />;
}
