import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import {
  findPaystackLiveSubscriptionRefund,
  verifyPaystackLiveSubscriptionRefund,
  verifyPaystackLiveSubscriptionTransaction,
} from "@/app/lib/payments/paystack-live-subscription-refunds";
import { recordSubscriptionRefundEvidence } from "@/app/lib/admin/subscription-refund-operations";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_growvelt_learning_admin");
  if (isAdmin !== true) return NextResponse.json({ code: "forbidden" }, { status: 403 });
  if (process.env.PAYSTACK_MODE !== "live") return NextResponse.json({ code: "refund_verification_unavailable" }, { status: 503 });

  const body = await request.json().catch(() => null) as { caseId?: unknown } | null;
  const caseId = Number(body?.caseId);
  if (!Number.isSafeInteger(caseId) || caseId <= 0) return NextResponse.json({ code: "invalid_request" }, { status: 400 });
  const admin = createAdminClient();
  const { data: refundCase, error: caseError } = await admin.from("learning_subscription_refund_cases")
    .select("id,invoice_id,status,amount_minor,currency,provider_transaction_id,provider_transaction_reference,provider_case_id,provider_case_reference,requested_at,updated_at")
    .eq("id", caseId).maybeSingle();
  if (caseError) return NextResponse.json({ code: "subscription_refund_lookup_failed" }, { status: 500 });
  if (!refundCase || !["requested", "submitting", "pending", "processing", "needs_attention"].includes(refundCase.status)
    || refundCase.currency !== "NGN" || !/^[1-9][0-9]{0,39}$/.test(refundCase.provider_transaction_id)
    || !refundCase.provider_transaction_reference) {
    return NextResponse.json({ code: "subscription_refund_not_recoverable" }, { status: 409 });
  }

  const { data: invoice, error: invoiceError } = await admin.from("learning_subscription_invoices")
    .select("id,provider_reference,payment_domain,status,amount_minor,currency,provider_transaction_id,provider_transaction_reference")
    .eq("id", refundCase.invoice_id).maybeSingle();
  if (invoiceError) return NextResponse.json({ code: "subscription_invoice_lookup_failed" }, { status: 500 });
  if (!invoice || invoice.payment_domain !== "live" || invoice.status !== "paid" || invoice.currency !== "NGN"
    || invoice.provider_transaction_id !== refundCase.provider_transaction_id
    || invoice.provider_transaction_reference !== refundCase.provider_transaction_reference
    || Number(invoice.amount_minor) !== Number(refundCase.amount_minor)) {
    return NextResponse.json({ code: "subscription_refund_charge_mismatch", message: "The paid invoice does not match the refund case. Continue manual review." }, { status: 409 });
  }

  try {
    const charge = await verifyPaystackLiveSubscriptionTransaction(refundCase.provider_transaction_reference);
    if (charge.status !== "success" || charge.transactionId !== refundCase.provider_transaction_id
      || charge.reference !== refundCase.provider_transaction_reference
      || charge.amountMinor !== Number(refundCase.amount_minor)
      || charge.requestedAmountMinor !== Number(refundCase.amount_minor)) {
      return NextResponse.json({ code: "subscription_refund_charge_mismatch", message: "The original payment could not be matched safely. Continue manual review." }, { status: 409 });
    }

    let providerRefundId = refundCase.provider_case_id as string | null;
    if (!providerRefundId) {
      const requestedAt = Date.parse(refundCase.requested_at);
      if (!Number.isFinite(requestedAt) || Date.now() - requestedAt < 15 * 60_000) {
        return NextResponse.json({ code: "subscription_refund_still_submitting", message: "The refund may still be processing. Check again after 15 minutes; do not submit another refund." }, { status: 409 });
      }
      const found = await findPaystackLiveSubscriptionRefund({
        caseId,
        transactionId: refundCase.provider_transaction_id,
        amountMinor: Number(refundCase.amount_minor),
        requestedAt: refundCase.requested_at,
      });
      if (!found) {
        return NextResponse.json({ code: "subscription_refund_not_found", message: "No matching provider refund was found. Keep this case under manual review; do not start another refund." }, { status: 409 });
      }
      providerRefundId = found.id;
      const { error: submissionError } = await admin.rpc("record_paystack_live_subscription_refund_submission", {
        p_case_id: caseId,
        p_provider_case_id: found.id,
        p_provider_status: found.status,
        p_provider_reference: found.refundReference,
        p_operator_id: user.id,
        p_failure_message: null,
      });
      if (submissionError) return NextResponse.json({ code: "subscription_refund_status_uncertain", message: "The located provider refund could not be attached safely. Continue manual review." }, { status: 409 });
    }

    const refund = await verifyPaystackLiveSubscriptionRefund({
      refundId: providerRefundId,
      transactionId: refundCase.provider_transaction_id,
      amountMinor: Number(refundCase.amount_minor),
      merchantNote: `Growvelt subscription refund case ${caseId}`,
    });
    const result = await recordSubscriptionRefundEvidence({
      admin,
      operatorId: user.id,
      refundCase: { case_id: caseId, status: refundCase.status, amount_minor: Number(refundCase.amount_minor), currency: refundCase.currency },
      invoiceReference: invoice.provider_reference,
      providerTransactionId: refundCase.provider_transaction_id,
      providerTransactionReference: refundCase.provider_transaction_reference,
      refund,
    });
    return NextResponse.json({ outcome: result.outcome }, { status: result.outcome === "refunded" ? 200 : 202 });
  } catch (error) {
    console.error("subscription_refund.operator_recovery_failed", {
      caseId, operatorId: user.id,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ code: "subscription_refund_recovery_failed", message: "The refund could not be verified safely." }, { status: 502 });
  }
}
