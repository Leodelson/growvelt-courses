import "server-only";
import { resolvePaystackConfiguration } from "@/app/lib/payments/paystack-config";
import { throwIfRefundFundingRejected } from "@/app/lib/payments/refund-initiation-error";
import {
  parsePaystackLiveSubscriptionRefund,
  parsePaystackLiveSubscriptionRefundListMatch,
  parsePaystackLiveSubscriptionTransaction,
  type PaystackSubscriptionRefund,
} from "@/app/lib/payments/paystack-subscription-refund-core";

function getLiveSubscriptionRefundConfig() {
  const config = resolvePaystackConfiguration(process.env);
  if (config.mode !== "live") throw new Error("Live subscription refund access requires Live Mode.");
  return config;
}
function requireLiveSubscriptionRefundWriteConfig() {
  const config = getLiveSubscriptionRefundConfig();
  if (!config.liveRefundsEnabled || process.env.GROWVELT_LEARNING_LIVE_SUBSCRIPTION_REFUNDS_ENABLED !== "true")
    throw new Error("Live subscription refunds are disabled.");
  return config;
}

async function readJson(response: Response) {
  return response.json().catch(() => null) as Promise<unknown>;
}

export async function verifyPaystackLiveSubscriptionTransaction(reference: string) {
  const config = getLiveSubscriptionRefundConfig();
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(reference)) throw new Error("Invalid subscription transaction reference.");
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${config.secretKey}` }, cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  const transaction = parsePaystackLiveSubscriptionTransaction(await readJson(response), reference);
  if (!response.ok || !transaction) throw new Error("Live subscription transaction verification was inconclusive.");
  return transaction;
}

async function listRefunds(transactionId: string) {
  const config = getLiveSubscriptionRefundConfig();
  if (!/^[1-9][0-9]{0,39}$/.test(transactionId)) throw new Error("Invalid subscription transaction ID.");
  const url = new URL("https://api.paystack.co/refund");
  url.searchParams.set("transaction", transactionId);
  url.searchParams.set("perPage", "100");
  url.searchParams.set("page", "1");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${config.secretKey}` }, cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  const body = await readJson(response);
  if (!response.ok) throw new Error("Live subscription refund inventory could not be verified.");
  return body;
}

export async function assertNoPriorPaystackLiveSubscriptionRefund(transactionId: string) {
  const inventory = await listRefunds(transactionId) as { status?: unknown; data?: unknown; meta?: { pageCount?: unknown } } | null;
  if (inventory?.status !== true || !Array.isArray(inventory.data)) throw new Error("Live subscription refund inventory is inconclusive.");
  if (inventory.data.length >= 100 || (inventory.meta?.pageCount !== undefined
    && inventory.meta.pageCount !== 1 && !(inventory.meta.pageCount === 0 && inventory.data.length === 0))
    || (inventory.meta?.pageCount === undefined && inventory.data.length >= 50)) {
    throw new Error("Live subscription refund inventory is incomplete.");
  }
  if (inventory.data.length !== 0) throw new Error("An existing refund requires manual review.");
}

export async function createPaystackLiveSubscriptionFullRefund(input: {
  caseId: number;
  transactionId: string;
  amountMinor: number;
  note: string;
}) {
  const config = requireLiveSubscriptionRefundWriteConfig();
  if (!Number.isSafeInteger(input.caseId) || input.caseId <= 0
    || !/^[1-9][0-9]{0,39}$/.test(input.transactionId)
    || !Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0
    || input.note.trim().length < 3 || input.note.trim().length > 2000) throw new Error("Invalid subscription refund target.");
  // Refund creation has no application idempotency key. Do not call POST if any
  // refund already exists for the charge; an ambiguous attempt is recovered by ID.
  await assertNoPriorPaystackLiveSubscriptionRefund(input.transactionId);
  const merchantNote = `Growvelt subscription refund case ${input.caseId}`;
  const response = await fetch("https://api.paystack.co/refund", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.secretKey}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ transaction: input.transactionId, amount: input.amountMinor,
      merchant_note: merchantNote, customer_note: "Growvelt subscription refund" }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await readJson(response) as { status?: unknown; message?: unknown; data?: unknown } | null;
  throwIfRefundFundingRejected(body);
  const refund = parsePaystackLiveSubscriptionRefund(body, {
    transactionId: input.transactionId, amountMinor: input.amountMinor, merchantNote,
  });
  if (!response.ok || !refund) throw new Error("Live subscription refund submission was inconclusive.");
  return refund;
}

export async function verifyPaystackLiveSubscriptionRefund(input: {
  refundId: string;
  transactionId: string;
  amountMinor: number;
  merchantNote: string;
}) {
  const config = getLiveSubscriptionRefundConfig();
  if (!/^[1-9][0-9]{0,39}$/.test(input.refundId) || !/^[1-9][0-9]{0,39}$/.test(input.transactionId)
    || !Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error("Invalid subscription refund ID.");
  const response = await fetch(`https://api.paystack.co/refund/${encodeURIComponent(input.refundId)}`, {
    headers: { Authorization: `Bearer ${config.secretKey}` }, cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  const refund = parsePaystackLiveSubscriptionRefund(await readJson(response), {
    transactionId: input.transactionId, amountMinor: input.amountMinor, merchantNote: input.merchantNote,
  });
  if (!response.ok || !refund || refund.id !== input.refundId) throw new Error("Live subscription refund verification was inconclusive.");
  return refund;
}

export async function findPaystackLiveSubscriptionRefund(input: {
  caseId: number;
  transactionId: string;
  amountMinor: number;
  requestedAt: string;
  now?: number;
}): Promise<PaystackSubscriptionRefund | null> {
  if (!Number.isSafeInteger(input.caseId) || input.caseId <= 0
    || !/^[1-9][0-9]{0,39}$/.test(input.transactionId) || !Number.isSafeInteger(input.amountMinor)
    || input.amountMinor <= 0 || !Number.isFinite(Date.parse(input.requestedAt))) {
    throw new Error("Invalid subscription refund recovery target.");
  }
  const merchantNote = `Growvelt subscription refund case ${input.caseId}`;
  const inventory = await listRefunds(input.transactionId);
  const refundId = parsePaystackLiveSubscriptionRefundListMatch(inventory, { ...input, merchantNote });
  return refundId ? verifyPaystackLiveSubscriptionRefund({
    refundId, transactionId: input.transactionId, amountMinor: input.amountMinor, merchantNote,
  }) : null;
}
