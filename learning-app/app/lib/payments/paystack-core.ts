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
