import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export function isTrustedPaystackAuthorizationUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "checkout.paystack.com";
  } catch {
    return false;
  }
}

export function verifyPaystackSignature(rawBody: string, signature: string | null, secretKey: string) {
  if (!signature || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expectedBuffer = createHmac("sha512", secretKey).update(rawBody).digest();
  const receivedBuffer = Buffer.from(signature, "hex");
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function digestPaystackPayload(rawBody: string) {
  return createHash("sha256").update(rawBody).digest("hex");
}

export type PaystackDomain = "test" | "live";

type ChargeSuccess = {
  eventId: string;
  reference: string;
  transactionId: string;
  amountMinor: number;
  currency: "NGN";
  domain: PaystackDomain;
  payload: Record<string, unknown>;
};

export type PaystackRefundEvent = {
  eventId: string;
  eventType: `refund.${"pending" | "processing" | "needs-attention" | "failed" | "processed"}`;
  transactionReference: string;
  refundId: string | null;
  refundReference: string | null;
  status: "pending" | "processing" | "needs-attention" | "failed" | "processed";
  amountMinor: number;
  currency: "NGN";
  domain: PaystackDomain;
  payload: Record<string, unknown>;
};

export type PaystackDisputeEvent = {
  eventId: string;
  eventType: "charge.dispute.create" | "charge.dispute.remind" | "charge.dispute.resolve";
  transactionReference: string;
  disputeId: string;
  status: string;
  resolution: string | null;
  amountMinor: number;
  currency: "NGN";
  domain: PaystackDomain;
  category: string | null;
  reason: string | null;
  deadline: string | null;
  payload: Record<string, unknown>;
};

export type PaystackCompanyReversalNotice = {
  eventType: "refund.pending" | "refund.processing" | "refund.needs-attention" | "refund.failed" | "refund.processed" | "charge.dispute.create" | "charge.dispute.remind" | "charge.dispute.resolve";
  transactionReference: string;
  providerCaseId: string;
  providerStatus: string;
  amountMinor: number;
  currency: "NGN";
  domain: PaystackDomain;
};

export type VerifiedPaystackCompanyReversal = {
  providerCaseId: string;
  transactionId: string;
  transactionReference: string;
  domain: PaystackDomain;
  currency: "NGN";
  amountMinor: number;
  providerStatus: string;
  providerResolution: string | null;
  finalOutcome: "processed_refund" | "lost_dispute" | null;
};

function paystackNumericId(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? String(value)
    : typeof value === "string" && /^[1-9]\d*$/.test(value) ? value : "";
}

function paystackPositiveAmount(value: unknown) {
  const parsed = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  return typeof parsed === "number" && Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseVerifiedPaystackCompanyRefund(
  value: unknown,
  expected: { refundId: string; transactionId: string; transactionReference: string; domain: PaystackDomain },
): VerifiedPaystackCompanyReversal | null {
  if (!value || typeof value !== "object" || !/^CP-[A-F0-9]{32}$/.test(expected.transactionReference)
      || !paystackNumericId(expected.refundId) || !paystackNumericId(expected.transactionId)) return null;
  const data = value as Record<string, unknown>;
  // Paystack's refund fetch can return a numeric transaction ID without a reference.
  const transaction = data.transaction && typeof data.transaction === "object"
    ? data.transaction as Record<string, unknown> : null;
  const transactionId = paystackNumericId(transaction?.id ?? data.transaction);
  const reference = transaction?.reference ?? data.transaction_reference;
  if (paystackNumericId(data.id) !== expected.refundId || transactionId !== expected.transactionId
      || (reference !== undefined && reference !== null && reference !== expected.transactionReference)
      || data.domain !== expected.domain || data.currency !== "NGN") return null;
  const amountMinor = paystackPositiveAmount(data.amount);
  const status = data.status;
  if (!amountMinor || typeof status !== "string"
      || !["pending", "processing", "needs-attention", "failed", "processed"].includes(status)) return null;
  return { providerCaseId: expected.refundId, transactionId, transactionReference: expected.transactionReference,
    domain: expected.domain, currency: "NGN", amountMinor, providerStatus: status,
    providerResolution: null, finalOutcome: status === "processed" ? "processed_refund" : null };
}

export function parseVerifiedPaystackCompanyDispute(
  value: unknown,
  expected: { disputeId: string; transactionId: string; transactionReference: string; domain: PaystackDomain },
): VerifiedPaystackCompanyReversal | null {
  if (!value || typeof value !== "object" || !/^CP-[A-F0-9]{32}$/.test(expected.transactionReference)
      || !paystackNumericId(expected.disputeId) || !paystackNumericId(expected.transactionId)) return null;
  const data = value as Record<string, unknown>;
  const transaction = data.transaction && typeof data.transaction === "object"
    ? data.transaction as Record<string, unknown> : null;
  if (!transaction || paystackNumericId(data.id) !== expected.disputeId
      || paystackNumericId(transaction.id) !== expected.transactionId
      || transaction.reference !== expected.transactionReference
      || data.domain !== expected.domain || transaction.domain !== expected.domain
      || transaction.currency !== "NGN"
      || (data.currency != null && data.currency !== "NGN")) return null;
  const amountMinor = paystackPositiveAmount(data.refund_amount ?? transaction.amount);
  const status = data.status;
  const resolution = typeof data.resolution === "string" ? data.resolution : null;
  if (!amountMinor || typeof status !== "string" || !status) return null;
  return { providerCaseId: expected.disputeId, transactionId: expected.transactionId,
    transactionReference: expected.transactionReference, domain: expected.domain,
    currency: "NGN", amountMinor, providerStatus: status, providerResolution: resolution,
    finalOutcome: status === "resolved" && resolution === "merchant-accepted" ? "lost_dispute" : null };
}

const companyReversalEventTypes = new Set<PaystackCompanyReversalNotice["eventType"]>([
  "refund.pending", "refund.processing", "refund.needs-attention", "refund.failed", "refund.processed",
  "charge.dispute.create", "charge.dispute.remind", "charge.dispute.resolve",
]);

export function isPaystackCompanyReversalEvent(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const event = value as { event?: unknown; data?: unknown };
  if (typeof event.event !== "string" || !companyReversalEventTypes.has(event.event as PaystackCompanyReversalNotice["eventType"]) || !event.data || typeof event.data !== "object") return false;
  const data = event.data as Record<string, unknown>;
  const transaction = data.transaction && typeof data.transaction === "object" ? data.transaction as Record<string, unknown> : {};
  const reference = data.transaction_reference ?? data.merchant_transaction_reference ?? transaction.reference;
  return typeof reference === "string" && /^CP-[A-F0-9]{32}$/.test(reference);
}

export function parsePaystackCompanyReversalNotice(value: unknown, expectedDomain: PaystackDomain): PaystackCompanyReversalNotice | null {
  if (!isPaystackCompanyReversalEvent(value)) return null;
  const event = value as { event: PaystackCompanyReversalNotice["eventType"]; data: Record<string, unknown> };
  const data = event.data;
  const transaction = data.transaction && typeof data.transaction === "object" ? data.transaction as Record<string, unknown> : {};
  const reference = data.transaction_reference ?? data.merchant_transaction_reference ?? transaction.reference;
  const rawCaseId = data.id ?? data.refund_reference;
  const providerCaseId = typeof rawCaseId === "number" && Number.isSafeInteger(rawCaseId) && rawCaseId > 0
    ? String(rawCaseId) : typeof rawCaseId === "string" && /^[A-Za-z0-9_-]{1,120}$/.test(rawCaseId) ? rawCaseId : "";
  const rawAmount = data.refund_amount ?? data.amount ?? transaction.amount;
  const amountMinor = typeof rawAmount === "string" && /^\d+$/.test(rawAmount) ? Number(rawAmount) : rawAmount;
  const currency = data.currency ?? transaction.currency;
  const domain = data.domain ?? transaction.domain;
  const expectedRefundStatus = event.event.startsWith("refund.") ? event.event.slice("refund.".length) : null;
  const providerStatus = expectedRefundStatus ?? (typeof data.status === "string" ? data.status : "");
  if (!providerCaseId || typeof reference !== "string" || !Number.isSafeInteger(amountMinor) || Number(amountMinor) <= 0
      || currency !== "NGN" || domain !== expectedDomain || !providerStatus || providerStatus.length > 80
      || (expectedRefundStatus && typeof data.status === "string" && data.status !== expectedRefundStatus)) return null;
  return { eventType: event.event, transactionReference: reference, providerCaseId, providerStatus,
    amountMinor: Number(amountMinor), currency: "NGN", domain: expectedDomain };
}

export type PaystackTransferEvent = {
  eventId: string;
  eventType: "transfer.success" | "transfer.failed" | "transfer.reversed";
  reference: string;
  transferId: string;
  transferCode: string | null;
  status: "succeeded" | "failed" | "reversed";
  amountMinor: number;
  currency: "NGN";
  domain: PaystackDomain;
  payload: Record<string, unknown>;
};

export function parsePaystackTransferEvent(value: unknown, expectedDomain: PaystackDomain): PaystackTransferEvent | null {
  if (!value || typeof value !== "object") return null;
  const event = value as { event?: unknown; data?: unknown };
  if (!(["transfer.success", "transfer.failed", "transfer.reversed"] as const).includes(event.event as never) || !event.data || typeof event.data !== "object") return null;
  const data = event.data as Record<string, unknown>;
  const reference = typeof data.reference === "string" ? data.reference : "";
  const transferId = typeof data.id === "number" && Number.isSafeInteger(data.id) ? String(data.id) : typeof data.id === "string" && /^\d+$/.test(data.id) ? data.id : "";
  const transferCode = typeof data.transfer_code === "string" && /^TRF_[A-Za-z0-9]+$/.test(data.transfer_code) ? data.transfer_code : null;
  const amount = typeof data.amount === "number" ? data.amount : typeof data.amount === "string" && /^\d+$/.test(data.amount) ? Number(data.amount) : NaN;
  const status = event.event === "transfer.success" ? "succeeded" : event.event === "transfer.failed" ? "failed" : "reversed";
  if (!/^lpi-[a-z0-9_-]{12,50}$/.test(reference) || !transferId || !Number.isSafeInteger(amount) || amount <= 0 || data.currency !== "NGN" || data.domain !== expectedDomain) return null;
  return { eventId: `${event.event}:${transferId}`, eventType: event.event as PaystackTransferEvent["eventType"], reference, transferId, transferCode, status, amountMinor: amount, currency: "NGN", domain: expectedDomain, payload: { transfer_id: transferId, transfer_code: transferCode, reference, amount, currency: "NGN", domain: expectedDomain, status } };
}

export function parsePaystackDisputeEvent(value: unknown, expectedDomain: PaystackDomain): PaystackDisputeEvent | null {
  if (!value || typeof value !== "object") return null;
  const event = value as { event?: unknown; data?: unknown };
  const allowed = new Set(["charge.dispute.create", "charge.dispute.remind", "charge.dispute.resolve"]);
  if (typeof event.event !== "string" || !allowed.has(event.event) || !event.data || typeof event.data !== "object") return null;
  const data = event.data as Record<string, unknown>;
  const transaction = data.transaction && typeof data.transaction === "object" ? data.transaction as Record<string, unknown> : {};
  const disputeId = typeof data.id === "number" && Number.isSafeInteger(data.id) ? String(data.id) : typeof data.id === "string" && /^\d+$/.test(data.id) ? data.id : "";
  const transactionReference = typeof data.transaction_reference === "string" ? data.transaction_reference
    : typeof data.merchant_transaction_reference === "string" ? data.merchant_transaction_reference
      : typeof transaction.reference === "string" ? transaction.reference : "";
  const amountValue = data.refund_amount ?? data.amount ?? transaction.amount;
  const amount = typeof amountValue === "string" && /^\d+$/.test(amountValue) ? Number(amountValue) : amountValue;
  const currency = data.currency ?? transaction.currency;
  const domain = data.domain ?? transaction.domain;
  const status = typeof data.status === "string" ? data.status : "";
  const resolution = typeof data.resolution === "string" && data.resolution ? data.resolution : null;
  const deadlineValue = data.due_at ?? data.dueAt ?? data.deadline;
  const deadline = typeof deadlineValue === "string" && !Number.isNaN(Date.parse(deadlineValue)) ? new Date(deadlineValue).toISOString() : null;
  if (!disputeId || !/^GL-[A-F0-9]{32}$/.test(transactionReference) || !Number.isSafeInteger(amount) || Number(amount) <= 0 || currency !== "NGN" || domain !== expectedDomain || !status) return null;
  const occurrence = data.updated_at ?? data.updatedAt ?? data.resolved_at ?? data.due_at ?? `${status}:${resolution ?? "none"}`;
  return {
    eventId: `${event.event}:${disputeId}:${String(occurrence)}`,
    eventType: event.event as PaystackDisputeEvent["eventType"],
    transactionReference,
    disputeId,
    status,
    resolution,
    amountMinor: Number(amount),
    currency: "NGN",
    domain: expectedDomain,
    category: typeof data.category === "string" ? data.category : null,
    reason: typeof data.reason === "string" ? data.reason : typeof data.note === "string" ? data.note : null,
    deadline,
    payload: { dispute_id: disputeId, transaction_reference: transactionReference, amount: Number(amount), currency: "NGN", domain: expectedDomain, status, resolution, category: data.category ?? null, reason: data.reason ?? data.note ?? null, due_at: deadline },
  };
}

export function parsePaystackRefundEvent(value: unknown, expectedDomain: PaystackDomain): PaystackRefundEvent | null {
  if (!value || typeof value !== "object") return null;
  const event = value as { event?: unknown; data?: unknown };
  const allowed = new Set(["refund.pending", "refund.processing", "refund.needs-attention", "refund.failed", "refund.processed"]);
  if (typeof event.event !== "string" || !allowed.has(event.event) || !event.data || typeof event.data !== "object") return null;
  const data = event.data as Record<string, unknown>;
  const status = event.event.slice("refund.".length) as PaystackRefundEvent["status"];
  const transactionReference = typeof data.transaction_reference === "string" ? data.transaction_reference : "";
  const refundId = typeof data.id === "number" && Number.isSafeInteger(data.id) ? String(data.id)
    : typeof data.id === "string" && /^\d+$/.test(data.id) ? data.id : null;
  const refundReference = typeof data.refund_reference === "string" && data.refund_reference.trim() ? data.refund_reference : null;
  const amount = typeof data.amount === "string" && /^\d+$/.test(data.amount) ? Number(data.amount) : data.amount;
  if (!/^GL-[A-F0-9]{32}$/.test(transactionReference) || !Number.isSafeInteger(amount) || Number(amount) <= 0 || data.currency !== "NGN" || data.domain !== expectedDomain || (typeof data.status === "string" && data.status !== status)) return null;
  return {
    eventId: `${event.event}:${refundId ?? refundReference ?? `${transactionReference}:${Number(amount)}`}`,
    eventType: event.event as PaystackRefundEvent["eventType"],
    transactionReference,
    refundId,
    refundReference,
    status,
    amountMinor: Number(amount),
    currency: "NGN",
    domain: expectedDomain,
    payload: {
      refund_id: refundId,
      refund_reference: refundReference,
      transaction_reference: transactionReference,
      amount: Number(amount),
      currency: data.currency,
      domain: data.domain,
      status,
      expected_at: data.expected_at ?? null,
      refunded_at: data.refunded_at ?? null,
      reason: data.reason ?? null,
    },
  };
}

export function parsePaystackChargeSuccess(value: unknown, expectedDomain: PaystackDomain): ChargeSuccess | null {
  if (!value || typeof value !== "object") return null;
  const event = value as { event?: unknown; data?: unknown };
  if (event.event !== "charge.success" || !event.data || typeof event.data !== "object") return null;
  const data = event.data as Record<string, unknown>;
  const reference = typeof data.reference === "string" ? data.reference : "";
  const transactionId = typeof data.id === "number" && Number.isSafeInteger(data.id)
    ? String(data.id)
    : typeof data.id === "string" && /^\d+$/.test(data.id) ? data.id : "";
  if (
    !/^GL-[A-F0-9]{32}$/.test(reference)
    || !transactionId
    || !Number.isSafeInteger(data.amount)
    || Number(data.amount) <= 0
    || data.currency !== "NGN"
    || data.domain !== expectedDomain
    || data.status !== "success"
  ) return null;
  return {
    eventId: expectedDomain === "test" ? `charge.success:${transactionId}` : `charge.success:${expectedDomain}:${transactionId}`,
    reference,
    transactionId,
    amountMinor: Number(data.amount),
    currency: "NGN",
    domain: expectedDomain,
    payload: {
      transaction_id: transactionId,
      reference,
      amount: data.amount,
      currency: data.currency,
      domain: data.domain,
      status: data.status,
      channel: data.channel ?? null,
      paid_at: data.paid_at ?? null,
    },
  };
}

export function parsePaystackCompanyChargeSuccess(value: unknown, expectedDomain: PaystackDomain): ChargeSuccess | null {
  if (!value || typeof value !== "object") return null;
  const event = value as { event?: unknown; data?: unknown };
  if (event.event !== "charge.success" || !event.data || typeof event.data !== "object") return null;
  const data = event.data as Record<string, unknown>;
  const reference = typeof data.reference === "string" ? data.reference : "";
  const transactionId = typeof data.id === "number" && Number.isSafeInteger(data.id)
    ? String(data.id)
    : typeof data.id === "string" && /^\d+$/.test(data.id) ? data.id : "";
  if (
    !/^CP-[A-F0-9]{32}$/.test(reference)
    || !transactionId
    || !Number.isSafeInteger(data.amount)
    || Number(data.amount) <= 0
    || data.currency !== "NGN"
    || data.domain !== expectedDomain
    || data.status !== "success"
  ) return null;
  return {
    eventId: expectedDomain === "test" ? `company.charge.success:${transactionId}` : `company.charge.success:${expectedDomain}:${transactionId}`,
    reference,
    transactionId,
    amountMinor: Number(data.amount),
    currency: "NGN",
    domain: expectedDomain,
    payload: {
      transaction_id: transactionId,
      reference,
      amount: data.amount,
      currency: data.currency,
      domain: data.domain,
      status: data.status,
      channel: data.channel ?? null,
      paid_at: data.paid_at ?? null,
    },
  };
}

export function parsePaystackTestDisputeEvent(value: unknown) {
  return parsePaystackDisputeEvent(value, "test");
}

export function parsePaystackTestRefundEvent(value: unknown) {
  return parsePaystackRefundEvent(value, "test");
}

export function parsePaystackTestChargeSuccess(value: unknown) {
  return parsePaystackChargeSuccess(value, "test");
}

export function parsePaystackTestTransferEvent(value: unknown) {
  return parsePaystackTransferEvent(value, "test");
}
