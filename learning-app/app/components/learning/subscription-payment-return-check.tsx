"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const CHECK_INTERVAL_MS = 3_000;
const MAX_AUTOMATIC_CHECKS = 30;

export function SubscriptionPaymentReturnCheck({ complete, reference }: { complete: boolean; reference: string }) {
  const router = useRouter();
  const checkingRef = useRef(false);
  const [checking, setChecking] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const checkNow = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/payments/paystack/subscriptions/status?reference=${encodeURIComponent(reference)}`, { cache: "no-store" });
      const result = await response.json().catch(() => null) as { accessActive?: boolean; invoiceStatus?: string } | null;
      if (response.ok && result?.accessActive) setMessage("Payment confirmed. Your subscription access is ready.");
      else if (response.ok && result?.invoiceStatus === "failed") setMessage("This payment was not confirmed. You can review the plan and try again; no access was granted.");
      else setMessage("Still waiting for Paystack’s verified confirmation. Please don’t pay again.");
    } catch {
      setMessage("We couldn’t check the subscription right now. Please don’t pay again; try again shortly.");
    } finally {
      checkingRef.current = false;
      setChecking(false);
      router.refresh();
    }
  }, [reference, router]);

  useEffect(() => {
    if (complete) return;
    let checks = 0;
    const initial = window.setTimeout(() => { void checkNow(); }, 0);
    const timer = window.setInterval(() => {
      checks += 1;
      if (checks >= MAX_AUTOMATIC_CHECKS) {
        window.clearInterval(timer);
        setTimedOut(true);
        return;
      }
      void checkNow();
    }, CHECK_INTERVAL_MS);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [checkNow, complete]);

  if (complete) return null;
  return <div className="payment-return-check" role="status" aria-live="polite">
    <p className="payment-return-check-message">
      {(checking || (!timedOut && !message)) && <span className="payment-return-spinner" aria-hidden="true" />}
      {message ?? (timedOut ? "We’re still waiting for Paystack’s signed confirmation. Please don’t pay again." : "Checking for Paystack’s signed confirmation…")}
    </p>
    <div className="payment-callback-actions">
      <button className="button button-primary" type="button" onClick={() => void checkNow()} disabled={checking}>{checking ? "Checking…" : "Check again"}</button>
      <Link className="button button-secondary" href="/dashboard/my-learning">My Learning</Link>
    </div>
  </div>;
}
