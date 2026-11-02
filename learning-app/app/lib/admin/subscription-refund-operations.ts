import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { digestPaystackPayload } from "@/app/lib/payments/paystack";
import { getSubscriptionInvoiceNotificationContext, sendPaymentNotification } from "@/app/lib/email/payment-notifications";
import type { PaystackSubscriptionRefund } from "@/app/lib/payments/paystack-subscription-refund-core";

type AdminClient = ReturnType<typeof createAdminClient>;
type RefundCase = { case_id: number; status: string; amount_minor: number; currency: string };

export async function recordSubscriptionRefundEvidence(input: {
  admin: AdminClient;
  operatorId: string;
  refundCase: RefundCase;
  invoiceReference: string;
  providerTransactionId: string;
  providerTransactionReference: string;
  refund: PaystackSubscriptionRefund;
}) {
  const refund = input.refund;
  const sanitizedPayload = {
    status: refund.status,
    domain: refund.domain,
    currency: refund.currency,
    amount_minor: refund.amountMinor,
    transaction_id: input.providerTransactionId,
    transaction_reference: input.providerTransactionReference,
    refund_id: refund.id,
    refund_reference: refund.refundReference,
  };
  const payloadDigest = digestPaystackPayload(JSON.stringify(refund.payload));
  const providerEventId = `refund-api-${input.refundCase.case_id}-${refund.id}-${randomUUID()}`;
  const { data: eventId, error: receiveError } = await input.admin.rpc(
    "receive_paystack_live_subscription_refund_verification",
    {
      p_case_id: input.refundCase.case_id,
      p_provider_event_id: providerEventId,
      p_payload_digest: payloadDigest,
      p_verification_source: "provider_api",
      p_provider_case_id: refund.id,
      p_provider_reference: refund.refundReference,
      p_provider_status: refund.status,
      p_amount_minor: refund.amountMinor,
      p_currency: refund.currency,
      p_domain: refund.domain,
      p_transaction_id: input.providerTransactionId,
      p_transaction_reference: input.providerTransactionReference,
      p_payload: sanitizedPayload,
      p_operator_id: input.operatorId,
    },
  );
  if (receiveError || !Number.isSafeInteger(Number(eventId)) || Number(eventId) <= 0) {
    throw new Error("Subscription refund evidence could not be recorded safely.");
  }

  let outcome: string = refund.status.replaceAll("-", "_");
  if (refund.status === "processed") {
    const { data, error } = await input.admin.rpc("process_paystack_live_subscription_refund_event", {
      p_event_id: Number(eventId),
    });
    if (error) throw new Error("Verified subscription refund could not be finalized safely.");
    outcome = (data as Array<{ outcome?: string }> | null)?.[0]?.outcome ?? refund.status;
  }

  const context = await getSubscriptionInvoiceNotificationContext(input.invoiceReference);
  if (context && outcome === "refunded") {
    await sendPaymentNotification({
      key: `subscription-refund-processed:${input.refundCase.case_id}:${eventId}`,
      type: "refund_processed",
      recipient: context.email,
      greeting: context.firstName ?? "there",
      subject: "Your Growvelt subscription refund was processed",
      heading: "Your refund was processed",
      message: `Growvelt confirmed the full refund for ${context.planName}. Any access provided only by this billing period has ended. Access from another valid source is unaffected. Provider processing time may still affect when funds appear.`,
    });
    await sendPaymentNotification({
      key: `subscription-access-ended:${input.refundCase.case_id}:${eventId}`,
      type: "access_revoked",
      recipient: context.email,
      greeting: context.firstName ?? "there",
      subject: "Growvelt subscription access updated",
      heading: "Subscription access has ended",
      message: `Access provided only by the refunded ${context.planName} billing period has ended. Your historical learning activity remains retained, and access from another valid source is unaffected.`,
    });
  } else if (context && ["failed", "needs_attention", "needs-attention"].includes(outcome)) {
    await sendPaymentNotification({
      key: `subscription-refund-attention:${input.refundCase.case_id}`,
      type: "refund_attention",
      recipient: context.email,
      greeting: context.firstName ?? "there",
      subject: "Your Growvelt subscription refund needs attention",
      heading: "Your refund needs attention",
      message: `The refund for ${context.planName} is not complete. Growvelt will review it; a pending or attention status is not a completed refund.`,
    });
  }
  return { eventId: Number(eventId), outcome };
}

export async function notifySubscriptionRefundRequested(input: {
  caseId: number;
  invoiceReference: string;
}) {
  const context = await getSubscriptionInvoiceNotificationContext(input.invoiceReference);
  if (!context) return;
  await sendPaymentNotification({
    key: `subscription-refund-requested:${input.caseId}`,
    type: "refund_requested",
    recipient: context.email,
    greeting: context.firstName ?? "there",
    subject: "Growvelt received your subscription refund request",
    heading: "",
    message: `Your full-refund request for ${context.planName} has been received. We will email you again when the refund status is confirmed.`,
  });
}

export async function notifySubscriptionRefundAttention(input: {
  caseId: number;
  invoiceReference: string;
}) {
  const context = await getSubscriptionInvoiceNotificationContext(input.invoiceReference);
  if (!context) return;
  await sendPaymentNotification({
    key: `subscription-refund-attention:${input.caseId}`,
    type: "refund_attention",
    recipient: context.email,
    greeting: context.firstName ?? "there",
    subject: "Your Growvelt subscription refund needs attention",
    heading: "Your refund needs attention",
    message: `The refund for ${context.planName} is not complete. Growvelt will review it; a pending or attention status is not a completed refund.`,
  });
}
