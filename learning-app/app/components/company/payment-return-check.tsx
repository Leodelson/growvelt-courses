"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function CompanyPaymentReturnCheck({ reference }: { reference: string }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const check = useCallback(async () => {
    setChecking(true);
    setMessage(null);
    try {
      const response = await fetch("/api/company/payments/paystack/reconcile", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference }),
      });
      const result = await response.json().catch(() => null) as { status?: string } | null;
      if (!response.ok || result?.status !== "paid") throw new Error("verification_deferred");
      router.refresh();
    } catch {
      setMessage("We could not confirm this payment yet. Please do not pay again. You can check this payment again.");
    } finally {
      setChecking(false);
    }
  }, [reference, router]);
  useEffect(() => { void check(); }, [check]);
  return <div className="payment-return-check" role="status">
    <p>{checking ? "Checking this company payment with Paystack…" : message}</p>
    {!checking && message && <button className="button button-primary" type="button" onClick={() => void check()}>Check payment again</button>}
  </div>;
}
