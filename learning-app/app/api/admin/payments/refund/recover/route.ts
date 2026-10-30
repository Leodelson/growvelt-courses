import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { findPaystackRefundIdForTransaction, getPaystackConfig, verifyPaystackLiveRefund, verifyPaystackTestRefund, verifyPaystackTransaction } from "@/app/lib/payments/paystack";
import { getOrderNotificationContext, sendPaymentNotification } from "@/app/lib/email/payment-notifications";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  let mode: "test" | "live";
  try { mode = getPaystackConfig(false).mode; } catch { return NextResponse.json({ code: "refunds_unavailable", message: "Paystack refund verification is unavailable." }, { status: 503 }); }
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_growvelt_learning_admin"); if (isAdmin !== true) return NextResponse.json({ code: "forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as { caseId?: unknown } | null;
  const caseId = Number(body?.caseId);
  if (!Number.isSafeInteger(caseId) || caseId <= 0) return NextResponse.json({ code: "invalid_request" }, { status: 400 });
  try {
    const admin = createAdminClient();
    const lookupFunction = mode === "live" ? "get_learning_live_refund_case_for_recovery" : "get_learning_test_refund_case_for_recovery";
    const { data: targets, error: targetError } = await admin.rpc(lookupFunction, { p_operator_id: user.id, p_case_id: caseId });
    if (targetError) throw targetError;
    let target = (targets as Array<{ order_reference: string; provider_case_id: string; provider_transaction_id: string }> | null)?.[0];
    if (!target) {
      // The ordinary recovery RPC intentionally excludes cases without a provider ID.
      // Investigate only a previously submitted, uncertain case; never create a refund here.
      const { data: refundCase, error: caseError } = await admin.from("learning_payment_cases")
        .select("order_id,payment_attempt_id,status,provider_case_id,provider_transaction_id,amount_minor,currency,requested_at,updated_at")
        .eq("id", caseId).eq("case_type", "refund").maybeSingle();
      if (caseError) throw caseError;
      if (!refundCase || !["needs_attention", "submitting"].includes(refundCase.status) || refundCase.provider_case_id !== null
        || !/^\d+$/.test(String(refundCase.provider_transaction_id)) || refundCase.currency !== "NGN")
        return NextResponse.json({ code: "refund_not_recoverable" }, { status: 409 });
      if (refundCase.status === "submitting") {
        const updatedAt = Date.parse(refundCase.updated_at);
        if (!Number.isFinite(updatedAt) || Date.now() - updatedAt < 15 * 60_000)
          return NextResponse.json({ code: "refund_still_submitting", message: "The refund request may still be processing. Check again after 15 minutes; do not submit another refund." }, { status: 409 });
      }
      const [{ data: attempt, error: attemptError }, { data: order, error: orderError }] = await Promise.all([
        admin.from("learning_payment_attempts").select("paystack_domain").eq("id", refundCase.payment_attempt_id).single(),
        admin.from("learning_orders").select("order_reference").eq("id", refundCase.order_id).single(),
      ]);
      if (attemptError || orderError) throw attemptError ?? orderError;
      if (!attempt || !order || (mode === "live" ? attempt.paystack_domain !== "live" : attempt.paystack_domain === "live"))
        return NextResponse.json({ code: "refund_not_recoverable" }, { status: 409 });
      let expectedRefundMinor = refundCase.amount_minor;
      if (mode === "live") {
        const charge = await verifyPaystackTransaction(order.order_reference, "live");
        if (charge.status !== "success" || charge.transactionId !== refundCase.provider_transaction_id
          || charge.requestedAmountMinor !== refundCase.amount_minor || charge.amountMinor < refundCase.amount_minor)
          return NextResponse.json({ code: "refund_charge_mismatch", message: "The original payment could not be matched safely. Continue manual review." }, { status: 409 });
        expectedRefundMinor = charge.amountMinor;
      }
      const refundId = await findPaystackRefundIdForTransaction({ transactionId: refundCase.provider_transaction_id,
        amountMinor: expectedRefundMinor, domain: mode, requestedAt: refundCase.requested_at });
      if (!refundId) {
        if (mode === "live" && refundCase.status === "needs_attention") {
          const { data: outcome, error: closeError } = await admin.rpc("close_unsubmitted_paystack_live_refund_case", {
            p_case_id: caseId, p_operator_id: user.id,
          });
          if (closeError) return NextResponse.json({ code: "refund_case_requires_review", message: "No provider refund attempt was found, but this case cannot yet be closed safely. Continue manual review." }, { status: 409 });
          return NextResponse.json({ outcome, message: "No provider refund attempt was found. This case was closed; a new refund may be requested after review." });
        }
        return NextResponse.json({ code: "refund_not_found", message: "No matching refund was found. Do not submit another refund; continue manual review." }, { status: 409 });
      }
      target = { order_reference: order.order_reference, provider_case_id: refundId, provider_transaction_id: refundCase.provider_transaction_id };
    }
    const verifyRefund = mode === "live" ? verifyPaystackLiveRefund : verifyPaystackTestRefund;
    const verified = await verifyRefund({ refundId: target.provider_case_id, transactionReference: target.order_reference, transactionId: target.provider_transaction_id });
    const receiveFunction = mode === "live" ? "receive_paystack_live_verified_refund" : "receive_paystack_test_verified_refund";
    const { data: eventId, error: receiveError } = await admin.rpc(receiveFunction, { p_case_id: caseId, p_provider_case_id: verified.id, p_provider_status: verified.status, p_provider_reference: verified.reference, p_amount_minor: verified.amountMinor, p_currency: verified.currency, p_domain: verified.domain, p_payload: verified.payload, p_operator_id: user.id });
    if (receiveError) throw receiveError;
    const recoverFunction = mode === "live" ? "recover_paystack_live_refund_event" : "recover_paystack_test_refund_event";
    const { data, error } = await admin.rpc(recoverFunction, { p_event_id: Number(eventId), p_operator_id: user.id }); if (error) throw error;
    const outcome=(data as Array<{ outcome?: string }> | null)?.[0]?.outcome??verified.status;
    const context=await getOrderNotificationContext(target.order_reference);
    if(context&&outcome==="refunded") { await sendPaymentNotification({key:`refund-processed:provider-api:${eventId}`,type:"refund_processed",recipient:context.email,greeting:context.firstName??"there",subject:"Your Growvelt refund was processed",heading:"Your refund was processed",message:`Paystack confirmed the full refund for ${context.courseTitle}.`,orderId:context.orderId,caseId}); await sendPaymentNotification({key:`access-revoked:refund:provider-api:${eventId}`,type:"access_revoked",recipient:context.email,greeting:context.firstName??"there",subject:"Growvelt course access updated",heading:"Course access has ended",message:`Access to ${context.courseTitle} ended after the processed refund. Your historical learning activity remains retained.`,orderId:context.orderId,caseId}); }
    else if(context&&["failed","needs_attention"].includes(outcome)) await sendPaymentNotification({key:`refund-attention:provider-api:${eventId}`,type:"refund_attention",recipient:context.email,greeting:context.firstName??"there",subject:"Your Growvelt refund needs attention",heading:"Your refund needs attention",message:`The refund for ${context.courseTitle} is not complete. Growvelt will review it.`,orderId:context.orderId,caseId});
    return NextResponse.json({ outcome });
  } catch (error) {
    console.error("refund.operator_recovery_failed", { provider: "paystack", caseId, operatorId: user.id, message: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ code: "recovery_failed", message: "The refund could not be verified safely." }, { status: 502 });
  }
}
