import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { getPaystackConfig, verifyPaystackTransaction } from "@/app/lib/payments/paystack";
import { getOrderNotificationContext, sendPaymentNotification } from "@/app/lib/email/payment-notifications";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return NextResponse.json({ code: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null) as { reference?: unknown } | null;
  const reference = typeof body?.reference === "string" ? body.reference.trim() : "";
  if (!/^GL-[A-F0-9]{32}$/.test(reference)) return NextResponse.json({ code: "invalid_reference" }, { status: 400 });

  try {
    const configuration = getPaystackConfig(false);
    const verified = await verifyPaystackTransaction(reference, configuration.mode);
    if (verified.status !== "success") {
      return NextResponse.json({ code: "pending", message: "Paystack has not confirmed a successful payment yet. No payment was repeated." }, { status: 409 });
    }

    const payload = {
      transaction_id: verified.transactionId,
      reference: verified.reference,
      amount: verified.requestedAmountMinor,
      requested_amount: verified.requestedAmountMinor,
      charged_amount: verified.amountMinor,
      fees: verified.feesMinor,
      currency: verified.currency,
      domain: verified.domain,
      status: verified.status,
      paid_at: verified.paidAt,
    };
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("reconcile_own_paystack_learning_payment", {
      p_learner_id: user.id,
      p_reference: reference,
      p_provider_transaction_id: verified.transactionId,
      p_amount_minor: verified.amountMinor,
      p_requested_amount_minor: verified.requestedAmountMinor,
      p_fees_minor: verified.feesMinor,
      p_currency: verified.currency,
      p_domain: verified.domain,
      p_payload: payload,
    });
    if (error) throw error;

    const result = (data as Array<{ outcome?: string; event_id?: number }> | null)?.[0];
    const outcome = result?.outcome ?? "unknown";
    if (outcome === "paid_and_enrolled" && result?.event_id) {
      const context = await getOrderNotificationContext(reference);
      if (context) await sendPaymentNotification({
        key: `payment-ready:provider-api:${result.event_id}`,
        type: "payment_access_ready",
        recipient: context.email,
        subject: "Your Growvelt Learning course is ready",
        heading: "Payment confirmed — access is ready",
        message: `Growvelt confirmed your payment for ${context.courseTitle}. The course is now available in My Learning.`,
        orderId: context.orderId,
      });
    }
    return NextResponse.json({ outcome });
  } catch (error) {
    console.error("payment.learner_reconciliation_failed", { provider: "paystack", reference, learnerId: user.id, message: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ code: "reconciliation_unavailable", message: "We could not confirm this payment right now. Please do not pay again; try checking again shortly." }, { status: 502 });
  }
}
