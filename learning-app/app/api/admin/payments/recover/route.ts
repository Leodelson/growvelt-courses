import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { verifyPaystackTestTransaction } from "@/app/lib/payments/paystack";
import { getOrderNotificationContext, sendPaymentNotification } from "@/app/lib/email/payment-notifications";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_growvelt_learning_admin");
  if (isAdmin !== true) return NextResponse.json({ code: "forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as { reference?: unknown } | null;
  const reference = typeof body?.reference === "string" ? body.reference.trim() : "";
  if (!/^GL-[A-F0-9]{32}$/.test(reference)) return NextResponse.json({ code: "invalid_reference" }, { status: 400 });
  const admin = createAdminClient();
  try {
    const verified = await verifyPaystackTestTransaction(reference);
    if (verified.status === "success") {
      const payload = { transaction_id: verified.transactionId, reference: verified.reference, amount: verified.amountMinor, currency: verified.currency, domain: verified.domain, status: verified.status, channel: null, paid_at: verified.paidAt };
      const { data: receivedId, error: receiveError } = await admin.rpc("receive_paystack_test_verified_transaction", { p_reference: reference, p_provider_transaction_id: verified.transactionId, p_amount_minor: verified.amountMinor, p_currency: verified.currency, p_domain: verified.domain, p_payload: payload, p_operator_id: user.id });
      if (receiveError) throw receiveError;
      const eventId = Number(receivedId);
      const { data, error } = await admin.rpc("recover_paystack_test_charge_event", { p_event_id: eventId, p_operator_id: user.id });
      if (error) throw error;
      const outcome=(data as Array<{ outcome?: string }> | null)?.[0]?.outcome??"unknown";
      const context=await getOrderNotificationContext(reference);
      if(context&&["paid_and_enrolled","already_paid"].includes(outcome)) await sendPaymentNotification({key:`payment-ready:provider-api:${eventId}`,type:"payment_access_ready",recipient:context.email,subject:"Your Growvelt Learning course is ready",heading:"Payment confirmed — access is ready",message:`Growvelt confirmed your payment for ${context.courseTitle}. The course is now available in My Learning.`,orderId:context.orderId});
      return NextResponse.json({ outcome });
    }
    if (["abandoned", "failed"].includes(verified.status)) {
      const { data, error } = await admin.rpc("abandon_verified_paystack_test_attempt", { p_order_reference: reference, p_operator_id: user.id, p_provider_status: verified.status, p_reason: "Paystack verification confirmed a stale non-success checkout" });
      if (error) throw error;
      return NextResponse.json({ outcome: data });
    }
    return NextResponse.json({ code: "pending", message: "Paystack has not returned a conclusive status. No local state was changed." }, { status: 409 });
  } catch (error) {
    console.error("payment.operator_recovery_failed", { provider: "paystack", reference, operatorId: user.id, message: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ code: "recovery_failed", message: "The payment could not be recovered safely." }, { status: 502 });
  }
}
