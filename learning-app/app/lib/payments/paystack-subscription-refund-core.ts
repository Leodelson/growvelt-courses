export type PaystackSubscriptionDomain = "live";
export type PaystackSubscriptionRefundStatus = "pending" | "processing" | "needs-attention" | "failed" | "processed";

export type PaystackSubscriptionTransaction = {
  reference: string;
  transactionId: string;
  amountMinor: number;
  requestedAmountMinor: number;
  currency: "NGN";
  domain: PaystackSubscriptionDomain;
  status: "success";
};

export type PaystackSubscriptionRefund = {
  id: string;
  transactionId: string;
  amountMinor: number;
  currency: "NGN";
  domain: PaystackSubscriptionDomain;
  status: PaystackSubscriptionRefundStatus;
  createdAt: string | null;
  refundReference: string | null;
  merchantNote: string;
  payload: Record<string, unknown>;
};

const referencePattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;
const transactionIdPattern = /^[1-9][0-9]{0,39}$/;
const refundStatuses = new Set<PaystackSubscriptionRefundStatus>([
  "pending", "processing", "needs-attention", "failed", "processed",
]);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
function positiveMinor(value: unknown): number | null {
  const parsed = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  return Number.isSafeInteger(parsed) && Number(parsed) > 0 ? Number(parsed) : null;
}

function nonnegativeMinor(value: unknown): number | null {
  const parsed = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  return Number.isSafeInteger(parsed) && Number(parsed) >= 0 ? Number(parsed) : null;
}

function providerId(value: unknown): string | null {
  const id = typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? String(value)
    : typeof value === "string" && transactionIdPattern.test(value) ? value : null;
  return id && transactionIdPattern.test(id) ? id : null;
}

/** Parse a server-verified Live transaction for a subscription invoice. */
export function parsePaystackLiveSubscriptionTransaction(
  value: unknown,
  expectedReference: string,
): PaystackSubscriptionTransaction | null {
  if (!referencePattern.test(expectedReference)) return null;
  const envelope = record(value);
  const data = record(envelope?.data);
  if (envelope?.status !== true || !data || data.reference !== expectedReference
    || data.domain !== "live" || data.currency !== "NGN" || data.status !== "success") return null;
  const transactionId = providerId(data.id);
  const amountMinor = positiveMinor(data.amount);
  const requestedAmountMinor = positiveMinor(data.requested_amount ?? data.amount);
  if (!transactionId || amountMinor === null || requestedAmountMinor === null) return null;
  const feesMinor = data.fees === undefined || data.fees === null ? null : nonnegativeMinor(data.fees);
  if (data.fees !== undefined && data.fees !== null && feesMinor === null) return null;
  if (feesMinor !== null && amountMinor !== requestedAmountMinor + feesMinor) return null;
  return {
    reference: expectedReference,
    transactionId,
    amountMinor,
    requestedAmountMinor,
    currency: "NGN",
    domain: "live",
    status: "success",
  };
}

function parseSubscriptionRefundData(
  data: Record<string, unknown> | null,
  expected: { transactionId: string; amountMinor: number; merchantNote: string },
): PaystackSubscriptionRefund | null {
  if (!data || !transactionIdPattern.test(expected.transactionId)
    || !Number.isSafeInteger(expected.amountMinor) || expected.amountMinor <= 0
    || typeof expected.merchantNote !== "string" || !expected.merchantNote.trim()) return null;
  const nestedTransaction = record(data.transaction);
  const transactionId = providerId(nestedTransaction?.id ?? data.transaction);
  const amountMinor = positiveMinor(data.amount);
  const normalizedStatus = typeof data.status === "string" ? data.status.trim().toLowerCase().replaceAll("_", "-") : "";
  const id = providerId(data.id);
  const optionalTransactionReference = typeof data.transaction_reference === "string"
    ? data.transaction_reference
    : typeof nestedTransaction?.reference === "string" ? nestedTransaction.reference : null;
  if (!id || transactionId !== expected.transactionId || amountMinor !== expected.amountMinor
    || data.currency !== "NGN" || data.domain !== "live"
    || (optionalTransactionReference !== null && !referencePattern.test(optionalTransactionReference))
    || !refundStatuses.has(normalizedStatus as PaystackSubscriptionRefundStatus)) return null;
  const createdAtValue = data.createdAt ?? data.created_at;
  const createdAt = typeof createdAtValue === "string" && Number.isFinite(Date.parse(createdAtValue))
    ? new Date(createdAtValue).toISOString()
    : null;
  const refundReference = typeof data.refund_reference === "string" && data.refund_reference.trim()
    ? data.refund_reference.trim().slice(0, 100)
    : null;
  const merchantNote = typeof data.merchant_note === "string" ? data.merchant_note : "";
  if (merchantNote !== expected.merchantNote) return null;
  return {
    id,
    transactionId,
    amountMinor,
    currency: "NGN",
    domain: "live",
    status: normalizedStatus as PaystackSubscriptionRefundStatus,
    createdAt,
    refundReference,
    merchantNote,
    payload: data,
  };
}

/** Paystack's refund object identifies the original charge by transaction ID. */
export function parsePaystackLiveSubscriptionRefund(
  value: unknown,
  expected: { transactionId: string; amountMinor: number; merchantNote: string },
): PaystackSubscriptionRefund | null {
  const envelope = record(value);
  return envelope?.status === true ? parseSubscriptionRefundData(record(envelope.data), expected) : null;
}

/** Only recover an unambiguous refund created after this local case was requested. */
export function parsePaystackLiveSubscriptionRefundListMatch(
  value: unknown,
  expected: { transactionId: string; amountMinor: number; requestedAt: string; merchantNote: string; now?: number },
): string | null {
  const envelope = record(value);
  if (envelope?.status !== true || !Array.isArray(envelope.data)) throw new Error("Refund inventory is inconclusive.");
  const rows = envelope.data;
  const meta = record(envelope.meta);
  if (rows.length >= 100 || (meta?.pageCount !== undefined && meta.pageCount !== 1 && !(meta.pageCount === 0 && rows.length === 0))
    || (meta?.pageCount === undefined && rows.length >= 50)) throw new Error("Refund inventory is incomplete.");
  if (rows.length === 0) return null;
  if (rows.length !== 1) throw new Error("Multiple refunds for this transaction require manual review.");
  const match = parseSubscriptionRefundData(record(rows[0]), expected);
  const requestedAt = Date.parse(expected.requestedAt);
  const createdAt = match?.createdAt ? Date.parse(match.createdAt) : NaN;
  const now = expected.now ?? Date.now();
  if (!match || !Number.isFinite(requestedAt) || !Number.isFinite(createdAt)
    || createdAt < requestedAt - 60_000 || createdAt > now + 60_000) {
    throw new Error("An existing or unverifiable refund requires manual review.");
  }
  return match.id;
}
