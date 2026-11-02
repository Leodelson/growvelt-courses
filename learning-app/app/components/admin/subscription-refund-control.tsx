"use client";

import { useMemo, useState } from "react";
import { History, RotateCcw, ShieldCheck } from "lucide-react";

type RefundEvent = {
  event_id: number;
  event_type: string;
  from_status: string | null;
  to_status: string;
  occurred_at: string;
};

type ExistingCase = {
  caseId: number;
  caseReference: string;
  status: string;
  providerStatus: string | null;
  providerCaseId: string | null;
  providerReference: string | null;
  events: RefundEvent[];
};

export function SubscriptionRefundControl({ invoiceReference, invoiceStatus, enabled, actionsEnabled = true, existingCase }: {
  invoiceReference: string;
  invoiceStatus: string;
  enabled: boolean;
  actionsEnabled?: boolean;
  existingCase?: ExistingCase;
}) {
  const [open, setOpen] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [reasonCode, setReasonCode] = useState("customer_request");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
  const terminalCase = existingCase && ["processed", "failed", "cancelled"].includes(existingCase.status);
  const canRequest = invoiceStatus === "paid" && enabled && actionsEnabled && (!existingCase || existingCase.status === "cancelled");
  const canVerify = Boolean(existingCase && actionsEnabled && !terminalCase &&
    (existingCase.providerCaseId || ["requested", "submitting", "pending", "processing", "needs_attention"].includes(existingCase.status)));

  async function submit() {
    if (!canRequest) return;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/payments/subscription-refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceReference, confirmation, reasonCode, note, idempotencyKey }),
      });
      const result = await response.json().catch(() => null) as { outcome?: string; message?: string } | null;
      setMessage(response.ok ? `Subscription refund status: ${result?.outcome ?? "submitted"}` : result?.message ?? "Refund could not be initiated.");
      if (response.ok) setTimeout(() => window.location.reload(), 700);
    } catch {
      setMessage("Refund could not be initiated.");
    } finally {
      setPending(false);
    }
  }

  async function recover() {
    if (!existingCase || !actionsEnabled) return;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/payments/subscription-refund/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: existingCase.caseId }),
      });
      const result = await response.json().catch(() => null) as { outcome?: string; message?: string } | null;
      setMessage(response.ok ? `Refund verification: ${result?.outcome ?? "verified"}` : result?.message ?? "Refund verification failed.");
      if (response.ok) setTimeout(() => window.location.reload(), 700);
    } catch {
      setMessage("Refund verification failed.");
    } finally {
      setPending(false);
    }
  }

  const unavailableReason = !actionsEnabled ? "Payment actions are disabled in this preview."
    : !enabled ? "Live subscription refunds are disabled."
      : invoiceStatus !== "paid" ? "Only paid Live invoices can be refunded."
      : existingCase?.status === "failed" ? "The provider confirmed a failed refund. Review the provider history before any retry."
        : existingCase && !terminalCase ? "An unresolved refund case already exists." : "";

  return <div className="payment-refund-control">
    <button className="payment-action-item" type="button" onClick={() => setOpen(true)} disabled={!canRequest} title={unavailableReason || undefined}>
      <RotateCcw size={18} aria-hidden="true" /><span>Full refund</span>
    </button>
    {canVerify ? <button className="payment-action-item" type="button" onClick={recover} disabled={pending}>
      <ShieldCheck size={18} aria-hidden="true" /><span>{pending ? "Verifying refund…" : "Verify refund"}</span>
    </button> : null}
    <button className="payment-action-item" type="button" onClick={() => setShowTimeline(current => !current)} disabled={!existingCase} title={existingCase ? undefined : "No refund history for this invoice."} aria-expanded={existingCase ? showTimeline : undefined}>
      <History size={18} aria-hidden="true" /><span>Refund timeline</span>
    </button>

    {showTimeline && existingCase ? <div className="payment-action-detail">
      <p><strong>Refund:</strong> {existingCase.status}{existingCase.providerStatus ? ` · ${existingCase.providerStatus}` : ""}</p>
      <p><small>Case: {existingCase.caseReference}</small></p>
      {existingCase.providerReference ? <p><small>Provider reference: {existingCase.providerReference}</small></p> : null}
      <ol className="payment-refund-timeline">{existingCase.events.map(event => <li key={event.event_id}>
        <strong>{event.to_status.replaceAll("_", " ")}</strong>
        <span>{new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.occurred_at))}</span>
      </li>)}</ol>
    </div> : null}

    {open && canRequest ? <div className="payment-refund-form payment-action-detail">
      <p><strong>Confirm an irreversible full subscription refund request</strong></p>
      <label>Reason<select value={reasonCode} onChange={event => setReasonCode(event.target.value)}><option value="customer_request">Customer request</option><option value="service_unavailable">Service unavailable</option><option value="duplicate_payment">Duplicate payment</option><option value="exceptional_admin_refund">Exceptional admin refund</option></select></label>
      <label>Operator note<textarea value={note} onChange={event => setNote(event.target.value)} maxLength={2000} /></label>
      <label>Type the exact invoice reference<input value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder={invoiceReference} /></label>
      <div><button className="button button-danger" type="button" onClick={submit} disabled={pending || confirmation !== invoiceReference || note.trim().length < 3}>{pending ? "Submitting refund…" : "Submit full refund"}</button><button className="button button-secondary" type="button" onClick={() => setOpen(false)} disabled={pending}>Cancel</button></div>
    </div> : null}
    {message ? <p className="payment-action-note" role="status">{message}</p> : null}
  </div>;
}
