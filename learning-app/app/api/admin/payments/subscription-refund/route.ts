import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { PaystackRefundFundingError } from "@/app/lib/payments/refund-initiation-error";
import {
  assertNoPriorPaystackLiveSubscriptionRefund,
  createPaystackLiveSubscriptionFullRefund,
  verifyPaystackLiveSubscriptionRefund,
  verifyPaystackLiveSubscriptionTransaction,
} from "@/app/lib/payments/paystack-live-subscription-refunds";
import { notifySubscriptionRefundAttention, notifySubscriptionRefundRequested, recordSubscriptionRefundEvidence } from "@/app/lib/admin/subscription-refund-operations";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  if (process.env.PAYSTACK_MODE !== "live" || process.env.PAYMENTS_LIVE_REFUNDS_ENABLED !== "true"
    || process.env.GROWVELT_LEARNING_LIVE_SUBSCRIPTION_REFUNDS_ENABLED !== "true") {
    return NextResponse.json({ code: "subscription_refunds_disabled", message: "Live subscription refunds are disabled." }, { status: 503 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_growvelt_learning_admin");
  if (isAdmin !== true) return NextResponse.json({ code: "forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null) as {
    invoiceReference?: unknown; confirmation?: unknown; reasonCode?: unknown; note?: unknown; idempotencyKey?: unknown;
  } | null;
  const invoiceReference = typeof body?.invoiceReference === "string" ? body.invoiceReference.trim() : "";
  const confirmation = typeof body?.confirmation === "string" ? body.confirmation.trim() : "";
  const reasonCode = typeof body?.reasonCode === "string" ? body.reasonCode.trim() : "";
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  const idempotencyKey = typeof body?.idempotencyKey === "string" && /^[0-9a-f-]{36}$/i.test(body.idempotencyKey)
    ? body.idempotencyKey : randomUUID();
  if (!/^GS-[A-F0-9]{32}$/.test(invoiceReference) || confirmation !== invoiceReference
    || !/^[a-z][a-z0-9_]{1,60}$/.test(reasonCode) || note.length < 3 || note.length > 2000) {
    return NextResponse.json({ code: "invalid_request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: invoice, error: invoiceError } = await admin.from("learning_subscription_invoices")
    .select("id,provider_reference,payment_domain,provider_transaction_id,provider_transaction_reference,amount_minor,currency,status")
    .eq("provider_reference", invoiceReference).maybeSingle();
  if (invoiceError) return NextResponse.json({ code: "invoice_lookup_failed" }, { status: 500 });
  if (!invoice || invoice.payment_domain !== "live" || invoice.status !== "paid" || invoice.currency !== "NGN"
    || !invoice.provider_transaction_id || !invoice.provider_transaction_reference) {
    return NextResponse.json({ code: "subscription_invoice_not_refundable", message: "A verified paid Live subscription invoice is required." }, { status: 409 });
  }

  try {
    const verifiedCharge = await verifyPaystackLiveSubscriptionTransaction(invoice.provider_transaction_reference);
    if (verifiedCharge.transactionId !== invoice.provider_transaction_id
      || verifiedCharge.reference !== invoice.provider_transaction_reference
      || verifiedCharge.amountMinor !== Number(invoice.amount_minor)
      || verifiedCharge.requestedAmountMinor !== Number(invoice.amount_minor)) {
      return NextResponse.json({ code: "subscription_charge_mismatch", message: "The original invoice payment could not be matched safely. No refund was started." }, { status: 409 });
    }
    await assertNoPriorPaystackLiveSubscriptionRefund(invoice.provider_transaction_id);
  } catch {
    return NextResponse.json({ code: "subscription_charge_or_refund_history_unverified", message: "The original payment or its refund history could not be verified safely. No refund was started." }, { status: 409 });
  }

  const { data: requested, error: requestError } = await admin.rpc("request_paystack_live_subscription_full_refund", {
    p_invoice_reference: invoiceReference,
    p_operator_id: user.id,
    p_idempotency_key: idempotencyKey,
    p_confirmation: confirmation,
    p_reason_code: reasonCode,
    p_operator_note: note,
  });
  if (requestError) return NextResponse.json({ code: "subscription_refund_not_eligible", message: "This invoice is not eligible for a new full refund." }, { status: 409 });
  const refundCase = (requested as Array<{
    case_id: number; status: string; amount_minor: number; currency: string;
    provider_transaction_id: string; provider_transaction_reference: string;
  }> | null)?.[0];
  if (!refundCase) return NextResponse.json({ code: "subscription_refund_case_creation_failed" }, { status: 500 });
  if (refundCase.status !== "requested") return NextResponse.json({ outcome: refundCase.status, caseId: refundCase.case_id });
  if (refundCase.provider_transaction_id !== invoice.provider_transaction_id
    || refundCase.provider_transaction_reference !== invoice.provider_transaction_reference
    || Number(refundCase.amount_minor) !== Number(invoice.amount_minor)) {
    return NextResponse.json({ code: "subscription_refund_case_mismatch", message: "The refund case does not match the verified invoice. No refund was started." }, { status: 409 });
  }
  await notifySubscriptionRefundRequested({ caseId: refundCase.case_id, invoiceReference });

  const { data: submissionState, error: submittingError } = await admin.rpc("mark_paystack_live_subscription_refund_submitting", {
    p_case_id: refundCase.case_id, p_operator_id: user.id,
  });
  if (submittingError) return NextResponse.json({ code: "subscription_refund_submission_failed" }, { status: 500 });
  if (submissionState !== "submitting") return NextResponse.json({
    code: "subscription_refund_already_submitting",
    message: "This refund is already being submitted or reviewed. Verify its status before taking another action.",
  }, { status: 409 });

  let providerRefund;
  try {
    providerRefund = await createPaystackLiveSubscriptionFullRefund({
      caseId: refundCase.case_id,
      transactionId: refundCase.provider_transaction_id,
      amountMinor: Number(refundCase.amount_minor),
      note,
    });
  } catch (error) {
    const providerStatus = error instanceof PaystackRefundFundingError ? "failed" : "needs-attention";
    const { error: recordError } = await admin.rpc("record_paystack_live_subscription_refund_submission", {
      p_case_id: refundCase.case_id,
      p_provider_case_id: null,
      p_provider_status: providerStatus,
      p_provider_reference: null,
      p_operator_id: user.id,
      p_failure_message: providerStatus === "failed" ? "Provider reported insufficient funds." : "Provider submission requires verification.",
    });
    if (recordError) return NextResponse.json({ code: "subscription_refund_status_uncertain", message: "The refund status could not be recorded safely. Review the case before another action." }, { status: 502 });
    if (providerStatus === "failed") {
      await notifySubscriptionRefundAttention({ caseId: refundCase.case_id, invoiceReference });
      return NextResponse.json({
        code: "subscription_refund_funding_unavailable",
        message: "The refund was not started because the payment account does not have enough available funds. The learner has not been refunded.",
      }, { status: 409 });
    }
    console.error("subscription_refund.initiation_uncertain", {
      caseId: refundCase.case_id, operatorId: user.id,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    await notifySubscriptionRefundAttention({ caseId: refundCase.case_id, invoiceReference });
    return NextResponse.json({ code: "subscription_refund_status_uncertain", message: "The refund request needs verification before another action." }, { status: 502 });
  }

  const { error: submissionError } = await admin.rpc("record_paystack_live_subscription_refund_submission", {
    p_case_id: refundCase.case_id,
    p_provider_case_id: providerRefund.id,
    p_provider_status: providerRefund.status,
    p_provider_reference: providerRefund.refundReference,
    p_operator_id: user.id,
    p_failure_message: null,
  });
  if (submissionError) {
    console.error("subscription_refund.local_submission_record_failed", { caseId: refundCase.case_id, operatorId: user.id });
    return NextResponse.json({ code: "subscription_refund_status_uncertain", message: "The provider accepted the request, but Growvelt must reconcile its status." }, { status: 202 });
  }
  try {
    const verifiedRefund = await verifyPaystackLiveSubscriptionRefund({
      refundId: providerRefund.id,
      transactionId: refundCase.provider_transaction_id,
      amountMinor: Number(refundCase.amount_minor),
      merchantNote: `Growvelt subscription refund case ${refundCase.case_id}`,
    });
    const result = await recordSubscriptionRefundEvidence({
      admin,
      operatorId: user.id,
      refundCase,
      invoiceReference,
      providerTransactionId: refundCase.provider_transaction_id,
      providerTransactionReference: refundCase.provider_transaction_reference,
      refund: verifiedRefund,
    });
    return NextResponse.json({ outcome: result.outcome, caseId: refundCase.case_id }, { status: result.outcome === "refunded" ? 200 : 202 });
  } catch (error) {
    console.error("subscription_refund.initial_verification_deferred", {
      caseId: refundCase.case_id, operatorId: user.id,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({
      outcome: providerRefund.status,
      caseId: refundCase.case_id,
      message: "The refund request was accepted but is not yet confirmed. Verify the case before taking another action.",
    }, { status: 202 });
  }
}
