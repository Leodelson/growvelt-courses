import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { digestPaystackPayload, getPaystackTestConfig, parsePaystackTestChargeSuccess, parsePaystackTestRefundEvent, verifyPaystackSignature } from "@/app/lib/payments/paystack";

export async function POST(request: Request) {
  let config; try { config = getPaystackTestConfig(false); } catch { return NextResponse.json({ code: "not_configured" }, { status: 503 }); }
  const rawBody = await request.text();
  if (!rawBody || rawBody.length > 262144) return NextResponse.json({ code: "invalid_payload" }, { status: 400 });
  if (!verifyPaystackSignature(rawBody, request.headers.get("x-paystack-signature"), config.secretKey)) return NextResponse.json({ code: "invalid_signature" }, { status: 401 });
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ code: "invalid_payload" }, { status: 400 });
  }
  const refund = parsePaystackTestRefundEvent(payload);
  if (refund) {
    const admin = createAdminClient();
    const { data: received, error: receiveError } = await admin.rpc("receive_paystack_test_refund_event", {
      p_provider_event_id: refund.eventId, p_payload_digest: digestPaystackPayload(rawBody), p_transaction_reference: refund.transactionReference,
      p_provider_case_id: refund.refundId, p_provider_status: refund.status, p_amount_minor: refund.amountMinor,
      p_currency: refund.currency, p_domain: refund.domain, p_payload: refund.payload,
    });
    if (receiveError) { console.error("refund.webhook_receive_failed", { provider: "paystack", transactionReference: refund.transactionReference, code: receiveError.code }); return NextResponse.json({ code: "receipt_failed" }, { status: 500 }); }
    const receipt = (received as Array<{ outcome?: string; event_id?: number }> | null)?.[0];
    if (!receipt?.event_id || receipt.outcome === "duplicate_payload_mismatch") return NextResponse.json({ code: "receipt_conflict" }, { status: 409 });
    const { data, error } = await admin.rpc("process_paystack_test_refund_event", { p_event_id: receipt.event_id });
    if (error) { console.error("refund.webhook_processing_deferred", { provider: "paystack", transactionReference: refund.transactionReference, eventId: receipt.event_id, code: error.code }); return NextResponse.json({ received: true, processing: "deferred" }); }
    const outcome = (data as Array<{ outcome?: string }> | null)?.[0]?.outcome;
    if (outcome && !["pending", "processing", "needs_attention", "failed", "refunded", "already_processed"].includes(outcome)) console.error("refund.webhook_manual_review", { provider: "paystack", transactionReference: refund.transactionReference, eventId: receipt.event_id, outcome });
    return NextResponse.json({ received: true });
  }
  const parsed = parsePaystackTestChargeSuccess(payload);
  if (!parsed) return new NextResponse(null, { status: 204 });
  const admin = createAdminClient();
  const { data: received, error: receiveError } = await admin.rpc("receive_paystack_test_charge_event", {
    p_provider_event_id: parsed.eventId, p_payload_digest: digestPaystackPayload(rawBody), p_reference: parsed.reference,
    p_provider_transaction_id: parsed.transactionId, p_amount_minor: parsed.amountMinor, p_currency: parsed.currency, p_domain: parsed.domain, p_payload: parsed.payload,
  });
  if (receiveError) { console.error("payment.webhook_receive_failed", { provider: "paystack", reference: parsed.reference, code: receiveError.code }); return NextResponse.json({ code: "receipt_failed" }, { status: 500 }); }
  const receipt = (received as Array<{ outcome?: string; event_id?: number }> | null)?.[0];
  if (!receipt?.event_id || receipt.outcome === "duplicate_payload_mismatch") {
    console.error("payment.webhook_receipt_conflict", { provider: "paystack", reference: parsed.reference, outcome: receipt?.outcome ?? "missing_receipt" });
    return NextResponse.json({ code: "receipt_conflict" }, { status: 409 });
  }
  const { data, error } = await admin.rpc("process_paystack_test_charge_event", { p_event_id: receipt.event_id });
  if (error) { console.error("payment.webhook_processing_deferred", { provider: "paystack", reference: parsed.reference, eventId: receipt.event_id, code: error.code }); return NextResponse.json({ received: true, processing: "deferred" }); }
  const outcome = (data as Array<{ outcome?: string }> | null)?.[0]?.outcome;
  if (outcome && !["paid_and_enrolled","already_processed","already_paid"].includes(outcome)) console.error("payment.webhook_manual_review", { provider: "paystack", reference: parsed.reference, eventId: receipt.event_id, outcome });
  return NextResponse.json({ received: true });
}
