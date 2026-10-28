"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const INITIAL_CHECK_INTERVAL_MS = 5_000;
const MAX_CHECK_INTERVAL_MS = 30_000;
const MAX_AUTOMATIC_CHECK_MS = 5 * 60_000;

type CheckOutcome = "pending" | "confirmed" | "failed" | "error" | "skipped";

export function SubscriptionPaymentReturnCheck({ complete, reference }: { complete: boolean; reference: string }) {
  const router = useRouter();
  const checkingRef = useRef(false);
  const [checking, setChecking] = useState(false);
  const [outcome, setOutcome] = useState<"pending" | "confirmed" | "failed" | "error">("pending");
  const [message, setMessage] = useState<string | null>(null);
  const [automaticChecksStopped, setAutomaticChecksStopped] = useState(false);

  const checkNow = useCallback(async (): Promise<CheckOutcome> => {
    if (checkingRef.current) return "skipped";
    checkingRef.current = true;
    setChecking(true);
    setMessage("Checking your payment confirmation. Please don’t pay again.");
    try {
      const response = await fetch(`/api/payments/paystack/subscriptions/status?reference=${encodeURIComponent(reference)}`, { cache: "no-store" });
      const result = await response.json().catch(() => null) as {
        accessActive?: boolean;
        invoiceStatus?: string;
        confirmationStatus?: "pending" | "failed";
      } | null;
      if (!response.ok) {
        setOutcome("error");
        setMessage("We couldn’t verify the payment just now. Please don’t pay again; you can check this same payment again.");
        return "error";
      }
      if (response.ok && result?.accessActive) {
        setOutcome("confirmed");
        setMessage("Payment confirmed. Your subscription access is ready.");
        router.refresh();
        return "confirmed";
      } else if (result?.confirmationStatus === "failed" || result?.invoiceStatus === "failed") {
        setOutcome("failed");
        setMessage("This payment was not confirmed. You can review the plan and try again; no access was granted.");
        router.refresh();
        return "failed";
      } else {
        setOutcome("pending");
        setMessage(automaticChecksStopped
          ? "Growvelt hasn’t confirmed this payment yet. Please don’t pay again; use Check again to recheck this same payment."
          : "Growvelt hasn’t confirmed this payment yet. We’ll check again automatically; please don’t pay again.");
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
  }, [automaticChecksStopped, reference, router]);

  useEffect(() => {
    if (complete || automaticChecksStopped) return;
    let cancelled = false;
    let timer: number | undefined;
    let delay = INITIAL_CHECK_INTERVAL_MS;
    const startedAt = Date.now();

    const stopAutomaticChecks = () => {
      setAutomaticChecksStopped(true);
      setOutcome("pending");
      setMessage("We still haven’t confirmed this payment. Please don’t pay again; use Check again to recheck this same payment.");
    };

    const poll = async () => {
      if (Date.now() - startedAt >= MAX_AUTOMATIC_CHECK_MS) {
        stopAutomaticChecks();
        return;
      }
      const result = await checkNow();
      if (cancelled || result === "confirmed" || result === "failed") return;
      if (Date.now() - startedAt >= MAX_AUTOMATIC_CHECK_MS) {
        stopAutomaticChecks();
        return;
      }
      timer = window.setTimeout(() => { void poll(); }, delay);
      delay = Math.min(delay * 2, MAX_CHECK_INTERVAL_MS);
    };

    const initial = window.setTimeout(() => { void poll(); }, 0);
    return () => { cancelled = true; window.clearTimeout(initial); if (timer !== undefined) window.clearTimeout(timer); };
  }, [automaticChecksStopped, checkNow, complete]);

  if (complete) return null;
  return <div className="payment-return-check" data-payment-outcome={outcome} role="status" aria-live="polite" aria-busy={checking}>
    <p className="payment-return-check-message">
      {checking && <span className="payment-return-spinner" aria-hidden="true" />}
      {message ?? "Still waiting for payment confirmation. We’ll keep checking automatically; please don’t pay again."}
    </p>
    <div className="payment-callback-actions">
      <button className="button button-primary" type="button" onClick={() => void checkNow()} disabled={checking}>{checking ? "Checking…" : "Check again"}</button>
      <Link className="button button-secondary" href="/dashboard/my-learning">My Courses</Link>
    </div>
  </div>;
}
