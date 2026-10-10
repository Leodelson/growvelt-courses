"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const CHECK_INTERVAL_MS = 3_000;
const MAX_AUTOMATIC_CHECKS = 30;

export function LearnerPaymentReturnCheck({ complete, reference }: { complete: boolean; reference: string }) {
  const router = useRouter();
  const checkingRef = useRef(false);
  const [checking, setChecking] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);

  const checkNow = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    setTimedOut(false);
    setCheckMessage(null);
    try {
      const response = await fetch("/api/payments/paystack/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ reference }),
      });
      const result = await response.json().catch(() => null) as { code?: string; outcome?: string; message?: string } | null;
      if (response.ok && ["paid_and_enrolled", "already_paid", "already_processed"].includes(result?.outcome ?? "")) {
        setCheckMessage("Payment verified. Updating your course access…");
      } else if (result?.code === "pending") {
        setCheckMessage("Paystack has not confirmed this payment yet. No payment was repeated.");
      } else {
        setCheckMessage(result?.message ?? "We couldn’t confirm the payment just now. Please don’t pay again; try checking again shortly.");
      }
    } catch {
      setCheckMessage("We couldn’t confirm the payment just now. Please don’t pay again; try checking again shortly.");
    } finally {
      checkingRef.current = false;
      setChecking(false);
      router.refresh();
    }
  }, [reference, router]);

  useEffect(() => {
    if (complete) return;

    const initialCheck = window.setTimeout(() => { void checkNow(); }, 0);
    let checks = 0;
    router.refresh();
    const timer = window.setInterval(() => {
      checks += 1;
      if (checks >= MAX_AUTOMATIC_CHECKS) {
        window.clearInterval(timer);
        setTimedOut(true);
        return;
      }
      router.refresh();
    }, CHECK_INTERVAL_MS);

    return () => {
      window.clearTimeout(initialCheck);
      window.clearInterval(timer);
    };
  }, [checkNow, complete, router]);

  if (complete) return null;

  return (
    <div className="payment-return-check" role="status" aria-live="polite">
      <p className="payment-return-check-message">
        {(checking || (!timedOut && !checkMessage)) && <span className="payment-return-spinner" aria-hidden="true" />}
        {checkMessage ?? (timedOut
          ? "We’re still waiting for Paystack’s verified confirmation. You can check again; please don’t pay again."
          : checking
            ? "Checking Paystack’s verified confirmation…"
            : "Checking for Paystack’s verified confirmation. Please don’t pay again.")}
      </p>
      <div className="payment-callback-actions">
        <button className="button button-primary" type="button" onClick={() => void checkNow()} disabled={checking}>
          {checking ? "Checking…" : "Check again"}
        </button>
        <Link className="button button-secondary" href="/dashboard/my-learning">My Learning</Link>
      </div>
    </div>
  );
}
