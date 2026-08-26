"use client";
import { useState } from "react";

export function PaymentRecoveryButton({ reference }: { reference: string }) {
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  async function recover() {
    setPending(true); setStatus("");
    try {
      const response = await fetch("/api/admin/payments/recover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference }) });
      const result = await response.json().catch(() => null) as { outcome?: string; message?: string } | null;
      setStatus(response.ok ? `Result: ${result?.outcome ?? "verified"}` : result?.message ?? "Recovery could not be completed.");
      if (response.ok) window.location.reload();
    } catch { setStatus("Recovery could not be completed."); }
    finally { setPending(false); }
  }
  return <div><button className="button button-secondary" type="button" onClick={recover} disabled={pending}>{pending ? "Verifying…" : "Verify with Paystack"}</button>{status ? <p role="status">{status}</p> : null}</div>;
}
