import "server-only";
import { isTrustedPaystackAuthorizationUrl } from "@/app/lib/payments/paystack-core";
import { resolvePaystackConfiguration } from "@/app/lib/payments/paystack-config";
import type { PaystackDomain } from "@/app/lib/payments/paystack-core";

export {
  digestPaystackPayload,
  isTrustedPaystackAuthorizationUrl,
  parsePaystackTestChargeSuccess,
  parsePaystackTestDisputeEvent,
  parsePaystackTestRefundEvent,
  parsePaystackChargeSuccess,
  parsePaystackDisputeEvent,
  parsePaystackRefundEvent,
  verifyPaystackSignature,
} from "@/app/lib/payments/paystack-core";

export type PaystackTestConfig = { secretKey: string; callbackUrl: string; checkoutEnabled: boolean; refundsEnabled: boolean };

export function getPaystackConfig(requireCheckout = false) {
  const config = resolvePaystackConfiguration(process.env);
  if (requireCheckout && !config.checkoutEnabled) throw new Error("Paystack checkout is disabled.");
  return config;
}

export function getPaystackTestConfig(requireCheckout = false): PaystackTestConfig {
  const config = getPaystackConfig(requireCheckout);
  // The database currently accepts only verified `domain = test` financial
  // events. A later, separately approved live-domain migration is required
  // before provider operations may run in live mode.
  if (config.mode !== "test") throw new Error("Live Paystack provider operations are not activated.");
  return config;
}

export function getPaystackLiveConfig(requireCheckout = false) {
  const config = getPaystackConfig(requireCheckout);
  if (config.mode !== "live") throw new Error("Paystack live mode is not configured.");
  return config;
}

export function requirePaystackTestRefundsEnabled() {
  const config = getPaystackTestConfig(false);
  if (!config.refundsEnabled) throw new Error("Paystack test refunds are disabled.");
  return config;
}

export async function initializePaystackTestTransaction(input: { email: string; amountMinor: number; reference: string; callbackUrl: string }) {
  const { secretKey } = getPaystackTestConfig(true);
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST", headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" }, cache: "no-store",
    body: JSON.stringify({ email: input.email, amount: String(input.amountMinor), currency: "NGN", reference: input.reference, callback_url: input.callbackUrl, metadata: { product: "growvelt_learning", order_reference: input.reference, environment: "test" } }),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json().catch(() => null) as { status?: unknown; message?: unknown; data?: { authorization_url?: unknown; reference?: unknown } } | null;
  const authorizationUrl = typeof result?.data?.authorization_url === "string" ? result.data.authorization_url : "";
  if (!response.ok || result?.status !== true || !isTrustedPaystackAuthorizationUrl(authorizationUrl) || result.data?.reference !== input.reference) throw new Error(typeof result?.message === "string" ? result.message : "Paystack initialization failed.");
  return { authorizationUrl };
}

export async function initializePaystackLiveTransaction(input: { email: string; amountMinor: number; reference: string; callbackUrl: string }) {
  const { secretKey } = getPaystackLiveConfig(true);
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST", headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" }, cache: "no-store",
    body: JSON.stringify({ email: input.email, amount: String(input.amountMinor), currency: "NGN", reference: input.reference, callback_url: input.callbackUrl, metadata: { product: "growvelt_learning", order_reference: input.reference, environment: "live" } }),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json().catch(() => null) as { status?: unknown; message?: unknown; data?: { authorization_url?: unknown; reference?: unknown } } | null;
  const authorizationUrl = typeof result?.data?.authorization_url === "string" ? result.data.authorization_url : "";
  if (!response.ok || result?.status !== true || !isTrustedPaystackAuthorizationUrl(authorizationUrl) || result.data?.reference !== input.reference) throw new Error(typeof result?.message === "string" ? result.message : "Paystack initialization failed.");
  return { authorizationUrl };
}

export type VerifiedPaystackTestTransaction = {
  reference: string;
  transactionId: string;
  amountMinor: number;
  currency: "NGN";
  domain: "test";
  status: string;
  paidAt: string | null;
};

export async function verifyPaystackTestTransaction(reference: string): Promise<VerifiedPaystackTestTransaction> {
  if (!/^GL-[A-F0-9]{32}$/.test(reference)) throw new Error("Invalid Growvelt payment reference.");
  const { secretKey } = getPaystackTestConfig(false);
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey}` }, cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  const result = await response.json().catch(() => null) as { status?: unknown; message?: unknown; data?: Record<string, unknown> } | null;
  const data = result?.data;
  const transactionId = typeof data?.id === "number" && Number.isSafeInteger(data.id) ? String(data.id) : typeof data?.id === "string" && /^\d+$/.test(data.id) ? data.id : "";
  if (!response.ok || result?.status !== true || !data || data.reference !== reference || !transactionId || !Number.isSafeInteger(data.amount) || data.currency !== "NGN" || data.domain !== "test" || typeof data.status !== "string") {
    throw new Error(typeof result?.message === "string" ? result.message : "Paystack verification failed.");
  }
  return { reference, transactionId, amountMinor: Number(data.amount), currency: "NGN", domain: "test", status: data.status, paidAt: typeof data.paid_at === "string" ? data.paid_at : null };
}

export async function verifyPaystackTransaction(reference: string, expectedDomain: PaystackDomain) {
  if (!/^GL-[A-F0-9]{32}$/.test(reference)) throw new Error("Invalid Growvelt payment reference.");
  const config = getPaystackConfig(false);
  if (config.mode !== expectedDomain) throw new Error("Paystack environment does not match this payment.");
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${config.secretKey}` }, cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  const result = await response.json().catch(() => null) as { status?: unknown; message?: unknown; data?: Record<string, unknown> } | null;
  const data = result?.data;
  const transactionId = typeof data?.id === "number" && Number.isSafeInteger(data.id) ? String(data.id) : typeof data?.id === "string" && /^\d+$/.test(data.id) ? data.id : "";
  if (!response.ok || result?.status !== true || !data || data.reference !== reference || !transactionId || !Number.isSafeInteger(data.amount) || data.currency !== "NGN" || data.domain !== expectedDomain || typeof data.status !== "string") throw new Error(typeof result?.message === "string" ? result.message : "Paystack verification failed.");
  return { reference, transactionId, amountMinor: Number(data.amount), currency: "NGN" as const, domain: expectedDomain, status: data.status, paidAt: typeof data.paid_at === "string" ? data.paid_at : null };
}

export type PaystackTestRefund = {
  id: string;
  reference: string | null;
  transactionReference: string;
  amountMinor: number;
  currency: "NGN";
  domain: "test";
  status: "pending" | "processing" | "needs-attention" | "failed" | "processed";
  payload: Record<string, unknown>;
};

function parsePaystackRefund(data: Record<string, unknown>, expected?: { transactionReference: string; transactionId: string }): PaystackTestRefund {
  const id = typeof data.id === "number" && Number.isSafeInteger(data.id) ? String(data.id) : typeof data.id === "string" && /^\d+$/.test(data.id) ? data.id : "";
  const transaction = data.transaction;
  const transactionReference = typeof data.transaction_reference === "string" ? data.transaction_reference
    : transaction && typeof transaction === "object" && typeof (transaction as Record<string, unknown>).reference === "string" ? String((transaction as Record<string, unknown>).reference)
    : expected?.transactionReference ?? "";
  const transactionId = typeof transaction === "number" && Number.isSafeInteger(transaction) ? String(transaction)
    : typeof transaction === "string" && /^\d+$/.test(transaction) ? transaction
    : transaction && typeof transaction === "object" && (typeof (transaction as Record<string, unknown>).id === "number" || typeof (transaction as Record<string, unknown>).id === "string") ? String((transaction as Record<string, unknown>).id) : "";
  const status = typeof data.status === "string" ? data.status : "";
  const amount = typeof data.amount === "string" && /^\d+$/.test(data.amount) ? Number(data.amount) : data.amount;
  if (!id || !/^GL-[A-F0-9]{32}$/.test(transactionReference) || (expected && (transactionReference !== expected.transactionReference || transactionId !== expected.transactionId))
    || !Number.isSafeInteger(amount) || Number(amount) <= 0 || data.currency !== "NGN" || data.domain !== "test"
    || !["pending", "processing", "needs-attention", "failed", "processed"].includes(status)) throw new Error("Paystack refund response was invalid.");
  return { id, reference: typeof data.refund_reference === "string" ? data.refund_reference : null, transactionReference, amountMinor: Number(amount), currency: "NGN", domain: "test", status: status as PaystackTestRefund["status"], payload: data };
}

export async function createPaystackTestFullRefund(input: { transactionId: string; transactionReference: string; note: string }) {
  if (!/^\d+$/.test(input.transactionId) || !/^GL-[A-F0-9]{32}$/.test(input.transactionReference)) throw new Error("Invalid refund target.");
  const { secretKey } = requirePaystackTestRefundsEnabled();
  const response = await fetch("https://api.paystack.co/refund", { method: "POST", headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ transaction: input.transactionId, merchant_note: input.note, customer_note: "Growvelt Learning course refund" }), signal: AbortSignal.timeout(15000) });
  const result = await response.json().catch(() => null) as { status?: unknown; message?: unknown; data?: Record<string, unknown> } | null;
  if (!response.ok || result?.status !== true || !result.data) throw new Error(typeof result?.message === "string" ? result.message : "Paystack refund initiation failed.");
  return parsePaystackRefund(result.data, { transactionReference: input.transactionReference, transactionId: input.transactionId });
}

export async function verifyPaystackTestRefund(input: { refundId: string; transactionReference: string; transactionId: string }) {
  if (!/^\d+$/.test(input.refundId) || !/^GL-[A-F0-9]{32}$/.test(input.transactionReference) || !/^\d+$/.test(input.transactionId)) throw new Error("Invalid refund reference.");
  const { secretKey } = requirePaystackTestRefundsEnabled();
  const response = await fetch(`https://api.paystack.co/refund/${encodeURIComponent(input.refundId)}`, { headers: { Authorization: `Bearer ${secretKey}` }, cache: "no-store", signal: AbortSignal.timeout(15000) });
  const result = await response.json().catch(() => null) as { status?: unknown; message?: unknown; data?: Record<string, unknown> } | null;
  if (!response.ok || result?.status !== true || !result.data) throw new Error(typeof result?.message === "string" ? result.message : "Paystack refund verification failed.");
  return parsePaystackRefund(result.data, { transactionReference: input.transactionReference, transactionId: input.transactionId });
}

export type PaystackTestDispute = { id: string; transactionReference: string; amountMinor: number; currency: "NGN"; domain: "test"; status: string; resolution: string | null; category: string | null; reason: string | null; deadline: string | null; payload: Record<string, unknown> };

export async function verifyPaystackTestDispute(input: { disputeId: string; transactionReference: string }): Promise<PaystackTestDispute> {
  if (!/^\d+$/.test(input.disputeId) || !/^GL-[A-F0-9]{32}$/.test(input.transactionReference)) throw new Error("Invalid dispute reference.");
  const { secretKey } = getPaystackTestConfig(false);
  const response = await fetch(`https://api.paystack.co/dispute/${encodeURIComponent(input.disputeId)}`, { headers: { Authorization: `Bearer ${secretKey}` }, cache: "no-store", signal: AbortSignal.timeout(15000) });
  const result = await response.json().catch(() => null) as { status?: unknown; message?: unknown; data?: Record<string, unknown> } | null;
  const data = result?.data; const transaction = data?.transaction && typeof data.transaction === "object" ? data.transaction as Record<string, unknown> : {};
  const id = typeof data?.id === "number" && Number.isSafeInteger(data.id) ? String(data.id) : typeof data?.id === "string" && /^\d+$/.test(data.id) ? data.id : "";
  const reference = typeof data?.transaction_reference === "string" ? data.transaction_reference : typeof transaction.reference === "string" ? transaction.reference : "";
  const amountValue = data?.refund_amount ?? data?.amount ?? transaction.amount; const amount = typeof amountValue === "string" && /^\d+$/.test(amountValue) ? Number(amountValue) : amountValue;
  const currency = data?.currency ?? transaction.currency; const domain = data?.domain ?? transaction.domain;
  if (!response.ok || result?.status !== true || !data || id !== input.disputeId || reference !== input.transactionReference || !Number.isSafeInteger(amount) || Number(amount)<=0 || currency!=="NGN" || domain!=="test" || typeof data.status!=="string") throw new Error(typeof result?.message === "string" ? result.message : "Paystack dispute verification failed.");
  const deadlineValue=data.due_at??data.dueAt??data.deadline; const deadline=typeof deadlineValue==="string"&&!Number.isNaN(Date.parse(deadlineValue))?new Date(deadlineValue).toISOString():null;
  return { id,transactionReference:reference,amountMinor:Number(amount),currency:"NGN",domain:"test",status:data.status,resolution:typeof data.resolution==="string"?data.resolution:null,category:typeof data.category==="string"?data.category:null,reason:typeof data.reason==="string"?data.reason:typeof data.note==="string"?data.note:null,deadline,payload:data };
}

export type PaystackTestResolvedAccount = {
  accountName: string;
  accountNumber: string;
  bankCode: string;
};

export type PaystackTestTransferRecipient = {
  recipientCode: string;
  providerRecipientId: string;
  bankCode: string;
  bankName: string;
  accountName: string;
  accountLast4: string;
  currency: "NGN";
  domain: "test";
};

function requirePaystackNubanInput(input: { accountNumber: string; bankCode: string }) {
  if (!/^\d{10}$/.test(input.accountNumber) || !/^[A-Za-z0-9_-]{2,32}$/.test(input.bankCode)) {
    throw new Error("Invalid Nigerian bank account details.");
  }
}

export async function resolvePaystackTestAccount(input: { accountNumber: string; bankCode: string }): Promise<PaystackTestResolvedAccount> {
  requirePaystackNubanInput(input);
  const { secretKey } = getPaystackTestConfig(false);
  const query = new URLSearchParams({ account_number: input.accountNumber, bank_code: input.bankCode });
  const response = await fetch(`https://api.paystack.co/bank/resolve?${query.toString()}`, {
    headers: { Authorization: `Bearer ${secretKey}` }, cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  const result = await response.json().catch(() => null) as { status?: unknown; message?: unknown; data?: Record<string, unknown> } | null;
  const data = result?.data;
  const accountName = typeof data?.account_name === "string" ? data.account_name.trim() : "";
  const returnedAccountNumber = typeof data?.account_number === "string" ? data.account_number.trim() : input.accountNumber;
  if (!response.ok || result?.status !== true || !accountName || returnedAccountNumber !== input.accountNumber) {
    throw new Error(typeof result?.message === "string" ? result.message : "Paystack account validation failed.");
  }
  return { accountName, accountNumber: input.accountNumber, bankCode: input.bankCode };
}

export async function createPaystackTestTransferRecipient(input: { accountNumber: string; bankCode: string; accountName: string }): Promise<PaystackTestTransferRecipient> {
  requirePaystackNubanInput(input);
  if (!input.accountName.trim() || input.accountName.length > 200) throw new Error("Invalid resolved account name.");
  const { secretKey } = getPaystackTestConfig(false);
  const response = await fetch("https://api.paystack.co/transferrecipient", {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      type: "nuban",
      name: input.accountName.trim(),
      account_number: input.accountNumber,
      bank_code: input.bankCode,
      currency: "NGN",
      metadata: { product: "growvelt_learning", environment: "test" },
    }),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json().catch(() => null) as { status?: unknown; message?: unknown; data?: Record<string, unknown> } | null;
  const data = result?.data;
  const recipientCode = typeof data?.recipient_code === "string" ? data.recipient_code : "";
  const recipientId = typeof data?.id === "number" && Number.isSafeInteger(data.id) ? String(data.id)
    : typeof data?.id === "string" && /^\d+$/.test(data.id) ? data.id : "";
  const details = data?.details && typeof data.details === "object" ? data.details as Record<string, unknown> : {};
  const returnedAccountNumber = typeof details.account_number === "string" ? details.account_number : "";
  const bankCode = typeof details.bank_code === "string" ? details.bank_code : "";
  const bankName = typeof details.bank_name === "string" ? details.bank_name.trim() : "";
  const accountName = typeof details.account_name === "string" ? details.account_name.trim() : input.accountName.trim();
  if (!response.ok || result?.status !== true || !/^RCP_[A-Za-z0-9]+$/.test(recipientCode) || !recipientId
    || data?.domain !== "test" || data?.currency !== "NGN" || returnedAccountNumber !== input.accountNumber
    || bankCode !== input.bankCode || !bankName || !accountName) {
    throw new Error(typeof result?.message === "string" ? result.message : "Paystack transfer recipient creation failed.");
  }
  return { recipientCode, providerRecipientId: recipientId, bankCode, bankName, accountName, accountLast4: input.accountNumber.slice(-4), currency: "NGN", domain: "test" };
}
