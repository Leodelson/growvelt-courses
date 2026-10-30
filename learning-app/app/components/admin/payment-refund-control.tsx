"use client";

import { useMemo, useState } from "react";
import { History, RotateCcw, ShieldCheck } from "lucide-react";

type ExistingCase = {
  caseId: number;
  status: string;
  providerStatus: string | null;
  providerCaseId: string | null;
  providerReference: string | null;
  events: Array<{
    event_id: number;
    event_type: string;
    normalized_status: string;
    provenance: string;
    note: string | null;
    created_at: string;
  }>;
};

export function PaymentRefundControl({ reference, orderStatus, enabled, refundEligible, actionsEnabled = true, existingCase }: {
  reference: string;
  orderStatus: string;
  enabled: boolean;
  refundEligible: boolean;
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

  const hasActiveCase = Boolean(existingCase && !["failed", "cancelled"].includes(existingCase.status));
  const canRequestRefund = orderStatus === "paid" && refundEligible && enabled && actionsEnabled && !hasActiveCase;
  const canVerifyRefund = Boolean(existingCase && actionsEnabled && existingCase.status !== "processed" &&
    (existingCase.providerCaseId || ["needs_attention", "submitting"].includes(existingCase.status)));
  const refundUnavailableReason = hasActiveCase ? "This order already has a refund case." :
    orderStatus !== "paid" ? "Only paid orders can be refunded." :
    !refundEligible ? "No successful payment was verified for this order." :
    !enabled ? "Full refunds are operationally disabled." :
    !actionsEnabled ? "Payment actions are disabled in this preview." : "";

  async function submit() {
    if (!canRequestRefund) return;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/payments/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, confirmation, reasonCode, note, idempotencyKey }),
      });
      const result = await response.json().catch(() => null) as { outcome?: string; message?: string } | null;
      setMessage(response.ok ? `Refund status: ${result?.outcome ?? "submitted"}` : result?.message ?? "Refund could not be initiated.");
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
      const response = await fetch("/api/admin/payments/refund/recover", {
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

  return <div className="payment-refund-control">
    <button className="payment-action-item" type="button" onClick={() => setOpen(true)} disabled={!canRequestRefund} title={refundUnavailableReason || undefined}>
      <RotateCcw size={18} aria-hidden="true" /><span>Full refund</span>
    </button>
    {canVerifyRefund ? <button className="payment-action-item" type="button" onClick={recover} disabled={pending}>
      <ShieldCheck size={18} aria-hidden="true" /><span>{pending ? "Verifying refund…" : "Verify refund"}</span>
    </button> : null}
    <button className="payment-action-item" type="button" onClick={() => setShowTimeline((current) => !current)} disabled={!existingCase} title={existingCase ? undefined : "No refund history for this order."} aria-expanded={existingCase ? showTimeline : undefined}>
      <History size={18} aria-hidden="true" /><span>Refund timeline</span>
    </button>

    {showTimeline && existingCase ? <div className="payment-action-detail">
      <p><strong>Refund:</strong> {existingCase.status}{existingCase.providerStatus ? ` · ${existingCase.providerStatus}` : ""}</p>
      {existingCase.providerReference ? <p><small>Provider reference: {existingCase.providerReference}</small></p> : null}
      <ol className="payment-refund-timeline">{existingCase.events.map((event) => <li key={event.event_id}>
        <strong>{event.normalized_status}</strong>
        <span>{event.provenance} · {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.created_at))}</span>
        {event.note ? <span>{event.note}</span> : null}
      </li>)}</ol>
    </div> : null}

    {open && canRequestRefund ? <div className="payment-refund-form payment-action-detail">
      <p><strong>Confirm an irreversible full refund request</strong></p>
      <label>Reason<select value={reasonCode} onChange={(event) => setReasonCode(event.target.value)}><option value="customer_request">Customer request</option><option value="course_unavailable">Course unavailable</option><option value="duplicate_payment">Duplicate payment</option><option value="exceptional_admin_refund">Exceptional admin refund</option></select></label>
      <label>Operator note<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} /></label>
      <label>Type the exact order reference<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={reference} /></label>
      <div><button className="button button-danger" type="button" onClick={submit} disabled={pending || confirmation !== reference || note.trim().length < 3}>{pending ? "Submitting refund…" : "Submit full refund"}</button><button className="button button-secondary" type="button" onClick={() => setOpen(false)} disabled={pending}>Cancel</button></div>
    </div> : null}
    {message ? <p className="payment-action-note" role="status">{message}</p> : null}
  </div>;
}
