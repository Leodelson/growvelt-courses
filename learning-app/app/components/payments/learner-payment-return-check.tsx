"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const CHECK_INTERVAL_MS = 3_000;
const MAX_AUTOMATIC_CHECKS = 30;

export function LearnerPaymentReturnCheck({ complete }: { complete: boolean }) {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);
  const [manualCheck, setManualCheck] = useState(false);
  const [pollCycle, setPollCycle] = useState(0);

  const checkNow = useCallback(() => {
    setTimedOut(false);
    setPollCycle((cycle) => cycle + 1);
    setManualCheck(true);
    window.setTimeout(() => setManualCheck(false), 1_200);
  }, []);

  useEffect(() => {
    if (complete) return;

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

    return () => window.clearInterval(timer);
  }, [complete, pollCycle, router]);

  if (complete) return null;

  return (
    <div className="payment-return-check" role="status" aria-live="polite">
      <p className="payment-return-check-message">
        <span className="payment-return-spinner" aria-hidden="true" />
        {timedOut
          ? "We’re still waiting for Paystack’s verified confirmation. You can check again; please don’t pay again."
          : manualCheck
            ? "Checking for Paystack’s verified confirmation…"
            : "Checking for Paystack’s verified confirmation. Please don’t pay again."}
      </p>
      <div className="payment-callback-actions">
        <button className="button button-primary" type="button" onClick={checkNow}>
          {manualCheck ? "Checking…" : "Check again"}
        </button>
        <Link className="button button-secondary" href="/dashboard/my-learning">My Learning</Link>
      </div>
    </div>
  );
}
