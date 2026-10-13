"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const INITIAL_CHECK_INTERVAL_MS = 5_000;
const MAX_CHECK_INTERVAL_MS = 30_000;

type CheckOutcome = "pending" | "confirmed" | "failed" | "error" | "skipped";

export function SubscriptionPaymentReturnCheck({ complete, reference }: { complete: boolean; reference: string }) {
  const router = useRouter();
  const checkingRef = useRef(false);
  const [checking, setChecking] = useState(false);
  const [outcome, setOutcome] = useState<"pending" | "confirmed" | "failed" | "error">("pending");
  const [message, setMessage] = useState<string | null>(null);

  const checkNow = useCallback(async (): Promise<CheckOutcome> => {
    if (checkingRef.current) return "skipped";
    checkingRef.current = true;
    setChecking(true);
    try {
      const response = await fetch(`/api/payments/paystack/subscriptions/status?reference=${encodeURIComponent(reference)}`, { cache: "no-store" });
      const result = await response.json().catch(() => null) as { accessActive?: boolean; invoiceStatus?: string } | null;
      if (response.ok && result?.accessActive) {
        setOutcome("confirmed");
        setMessage("Payment confirmed. Your subscription access is ready.");
        router.refresh();
        return "confirmed";
      } else if (response.ok && result?.invoiceStatus === "failed") {
        setOutcome("failed");
        setMessage("This payment was not confirmed. You can review the plan and try again; no access was granted.");
        router.refresh();
        return "failed";
      } else {
        setOutcome("pending");
        setMessage(null);
        return "pending";
      }
    } catch {
      setOutcome("error");
      setMessage("We couldn’t check the subscription just now. We’ll continue checking automatically; please don’t pay again.");
      return "error";
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  }, [reference, router]);

  useEffect(() => {
    if (complete) return;
    let cancelled = false;
    let timer: number | undefined;
    let delay = INITIAL_CHECK_INTERVAL_MS;

    const poll = async () => {
      const result = await checkNow();
      if (cancelled || result === "confirmed" || result === "failed") return;
      timer = window.setTimeout(() => { void poll(); }, delay);
      delay = Math.min(delay * 2, MAX_CHECK_INTERVAL_MS);
    };

    const initial = window.setTimeout(() => { void poll(); }, 0);
    return () => { cancelled = true; window.clearTimeout(initial); if (timer !== undefined) window.clearTimeout(timer); };
  }, [checkNow, complete]);

  if (complete) return null;
  return <div className="payment-return-check" role="status" aria-live="polite">
    <p className="payment-return-check-message">
      {(checking || outcome === "pending" || outcome === "error") && <span className="payment-return-spinner" aria-hidden="true" />}
      {message ?? "Still waiting for Paystack’s verified confirmation. We’ll keep checking automatically; please don’t pay again."}
    </p>
    <div className="payment-callback-actions">
      <button className="button button-primary" type="button" onClick={() => void checkNow()} disabled={checking}>{checking ? "Checking…" : "Check again"}</button>
      <Link className="button button-secondary" href="/dashboard/my-learning">My Learning</Link>
    </div>
  </div>;
}
