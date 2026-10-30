"use client";

import { useRef, useState } from "react";

type Props = { action: "approve" | "submit" | "otp" | "recover"; reservationId?: number; payoutItemId?: number; reference: string };

const labels = {
  approve: "Approve Live payout",
  submit: "Initiate Live transfer",
  otp: "Confirm transfer OTP",
  recover: "Verify Live transfer",
};

export function CommercialLivePayoutControl({ action, reservationId, payoutItemId, reference }: Props) {
  const [confirmation, setConfirmation] = useState("");
  const [otpLength, setOtpLength] = useState(0);
  const [state, setState] = useState<"idle" | "working" | "done" | "failed">("idle");
  const otpRef = useRef<HTMLInputElement>(null);
  const needsConfirmation = action !== "recover";
  const ready = (!needsConfirmation || confirmation === reference) && (action !== "otp" || otpLength === 6);
  async function run() {
    if (!ready || state !== "idle") return;
    if (action === "otp" && !/^\d{6}$/.test(otpRef.current?.value ?? "")) return;
    if (action === "approve" && !reservationId || action !== "approve" && !payoutItemId) return;
    if (!window.confirm(`${labels[action]} for ${reference}? ${action === "submit" || action === "otp" ? "This may move real money. Check the amount and recipient first." : "Review the current record first."}`)) return;
    const otp = action === "otp" ? otpRef.current?.value : undefined;
    if (otpRef.current) otpRef.current.value = "";
    setOtpLength(0);
    setState("working");
    try {
      const url = action === "approve" ? "/api/admin/commercial/payout-items/approve"
        : action === "submit" ? "/api/admin/commercial/payout-items/submit-live"
        : action === "otp" ? "/api/admin/commercial/payout-items/finalize-live-otp"
        : "/api/admin/commercial/payout-items/recover-live";
      const body = action === "approve" ? { reservationId, domain: "live" } : action === "otp" ? { payoutItemId, otp } : { payoutItemId };
      const response = await fetch(url, { method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
      if (!response.ok) throw new Error("Payout action requires review.");
      setState("done");
      setConfirmation("");
    } catch { setState("failed"); }
  }
  return <div className="commercial-release-control">
    {needsConfirmation && <label>Type the payout reference to confirm
      <input type="text" value={confirmation} onChange={event => setConfirmation(event.target.value)}
        autoComplete="off" spellCheck={false} aria-label="Confirm payout reference" disabled={state !== "idle"} />
    </label>}
    {action === "otp" && <label>Transfer confirmation code
      <input ref={otpRef} type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
        autoComplete="one-time-code" aria-label="Transfer confirmation code" disabled={state !== "idle"} onChange={event => setOtpLength(event.target.value.length)} />
    </label>}
    <button type="button" className="button button-primary" onClick={run}
      disabled={!ready || state !== "idle"}>{state === "working" ? "Working…" : labels[action]}</button>
    {state === "done" && <p className="commercial-release-result">Request accepted. Refresh to review the authoritative transfer status; this is not proof of bank settlement.</p>}
    {state === "failed" && <p className="commercial-release-result is-error">Status is unclear or the action is unavailable. Verify the provider reference before any further action.</p>}
  </div>;
}
