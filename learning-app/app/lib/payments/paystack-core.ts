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

type ChargeSuccess = {
  eventId: string;
  reference: string;
  transactionId: string;
  amountMinor: number;
  currency: "NGN";
  domain: "test";
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
  domain: "test";
  payload: Record<string, unknown>;
};

export function parsePaystackTestRefundEvent(value: unknown): PaystackRefundEvent | null {
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
  if (!/^GL-[A-F0-9]{32}$/.test(transactionReference) || !Number.isSafeInteger(amount) || Number(amount) <= 0 || data.currency !== "NGN" || data.domain !== "test" || (typeof data.status === "string" && data.status !== status)) return null;
  return {
    eventId: `${event.event}:${refundId ?? refundReference ?? `${transactionReference}:${Number(amount)}`}`,
    eventType: event.event as PaystackRefundEvent["eventType"],
    transactionReference,
    refundId,
    refundReference,
    status,
    amountMinor: Number(amount),
    currency: "NGN",
    domain: "test",
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

export function parsePaystackTestChargeSuccess(value: unknown): ChargeSuccess | null {
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
    || data.domain !== "test"
    || data.status !== "success"
  ) return null;
  return {
    eventId: `charge.success:${transactionId}`,
    reference,
    transactionId,
    amountMinor: Number(data.amount),
    currency: "NGN",
    domain: "test",
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
