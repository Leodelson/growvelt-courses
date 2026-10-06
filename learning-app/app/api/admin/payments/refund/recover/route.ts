import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { getPaystackConfig, verifyPaystackLiveRefund, verifyPaystackTestRefund } from "@/app/lib/payments/paystack";
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
    const target = (targets as Array<{ order_reference: string; provider_case_id: string; provider_transaction_id: string }> | null)?.[0];
    if (targetError || !target) return NextResponse.json({ code: "refund_not_recoverable" }, { status: 409 });
    const verifyRefund = mode === "live" ? verifyPaystackLiveRefund : verifyPaystackTestRefund;
    const verified = await verifyRefund({ refundId: target.provider_case_id, transactionReference: target.order_reference, transactionId: target.provider_transaction_id });
    const receiveFunction = mode === "live" ? "receive_paystack_live_verified_refund" : "receive_paystack_test_verified_refund";
    const { data: eventId, error: receiveError } = await admin.rpc(receiveFunction, { p_case_id: caseId, p_provider_case_id: verified.id, p_provider_status: verified.status, p_provider_reference: verified.reference, p_amount_minor: verified.amountMinor, p_currency: verified.currency, p_domain: verified.domain, p_payload: verified.payload, p_operator_id: user.id });
    if (receiveError) throw receiveError;
    const recoverFunction = mode === "live" ? "recover_paystack_live_refund_event" : "recover_paystack_test_refund_event";
    const { data, error } = await admin.rpc(recoverFunction, { p_event_id: Number(eventId), p_operator_id: user.id }); if (error) throw error;
    const outcome=(data as Array<{ outcome?: string }> | null)?.[0]?.outcome??verified.status;
    const context=await getOrderNotificationContext(target.order_reference);
    if(context&&outcome==="refunded") { await sendPaymentNotification({key:`refund-processed:provider-api:${eventId}`,type:"refund_processed",recipient:context.email,subject:"Your Growvelt Learning refund was processed",heading:"Your refund was processed",message:`Paystack confirmed the full refund for ${context.courseTitle}.`,orderId:context.orderId,caseId}); await sendPaymentNotification({key:`access-revoked:refund:provider-api:${eventId}`,type:"access_revoked",recipient:context.email,subject:"Growvelt Learning course access updated",heading:"Course access has ended",message:`Access to ${context.courseTitle} ended after the processed refund. Your historical learning activity remains retained.`,orderId:context.orderId,caseId}); }
    else if(context&&["failed","needs_attention"].includes(outcome)) await sendPaymentNotification({key:`refund-attention:provider-api:${eventId}`,type:"refund_attention",recipient:context.email,subject:"Your Growvelt Learning refund needs attention",heading:"Your refund needs attention",message:`The refund for ${context.courseTitle} is not complete. Growvelt will review it.`,orderId:context.orderId,caseId});
    return NextResponse.json({ outcome });
  } catch (error) {
    console.error("refund.operator_recovery_failed", { provider: "paystack", caseId, operatorId: user.id, message: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ code: "recovery_failed", message: "The refund could not be verified safely." }, { status: 502 });
  }
}
