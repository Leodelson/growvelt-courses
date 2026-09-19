"use client";

import { useState } from "react";

export function CommercialPayoutTransferControl({ reservationId, payoutItemId, providerEventId, canSubmit, canRecover }: { reservationId?: number; payoutItemId?: number; providerEventId?: number; canSubmit?: boolean; canRecover?: boolean }) {
  const [state, setState] = useState<"idle" | "working" | "done" | "failed">("idle");
  const approve = Boolean(reservationId); const recover = Boolean(canRecover && payoutItemId); const reprocess = Boolean(providerEventId);
  async function run() {
    setState("working");
    try {
      const response = await fetch(approve ? "/api/admin/commercial/payout-items/approve" : reprocess ? "/api/admin/commercial/payout-items/reprocess-event" : recover ? "/api/admin/commercial/payout-items/recover-test" : "/api/admin/commercial/payout-items/submit-test", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(approve ? { reservationId } : reprocess ? { providerEventId } : { payoutItemId }) });
      if (!response.ok) throw new Error("Unavailable");
      setState("done");
    } catch { setState("failed"); }
  }
  if (!approve && !canSubmit && !recover && !reprocess) return null;
  return <div className="commercial-release-control"><button className="button button-primary" type="button" onClick={run} disabled={state === "working"}>{state === "working" ? "Working…" : approve ? "Approve Test payout" : reprocess ? "Reprocess provider event" : recover ? "Verify Test transfer" : "Submit Test transfer"}</button>{state === "done" && <p className="commercial-release-result">Completed. Refresh this page to view the authoritative status.</p>}{state === "failed" && <p className="commercial-release-result is-error">This action could not be completed safely.</p>}</div>;
}
