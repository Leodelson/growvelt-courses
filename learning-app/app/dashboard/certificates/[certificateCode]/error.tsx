"use client";
import { RouteError } from "@/app/components/ui/route-error";
export default function CertificateError({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <RouteError title="Unable to load certificate" description="Please try again, or return to your certificate list." reset={reset} recoveryHref="/dashboard/certificates" recoveryLabel="Back to certificates" />; }
