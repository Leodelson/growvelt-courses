import "server-only";
import { isTrustedPaystackAuthorizationUrl, parseVerifiedPaystackCompanyDispute, parseVerifiedPaystackCompanyRefund } from "@/app/lib/payments/paystack-core";
import { resolvePaystackConfiguration } from "@/app/lib/payments/paystack-config";
import { verifyCompanySettlementEvidence } from "@/app/lib/payments/company-settlement-core";
import type { CompanySettlementLookup } from "@/app/lib/payments/company-settlement-core";
import type { PaystackDomain } from "@/app/lib/payments/paystack-core";

export {
  digestPaystackPayload,
  isTrustedPaystackAuthorizationUrl,
  isPaystackCompanyReversalEvent,
  parsePaystackTestChargeSuccess,
  parsePaystackTestDisputeEvent,
  parsePaystackTestRefundEvent,
  parsePaystackTestTransferEvent,
  parsePaystackChargeSuccess,
  parsePaystackCompanyChargeSuccess,
  parsePaystackCompanyReversalNotice,
  parsePaystackDisputeEvent,
  parsePaystackRefundEvent,
  parsePaystackTransferEvent,
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
  // Test-only helpers must never select Live credentials. Live provider
  // operations use their explicit Live-mode counterparts below.
  if (config.mode !== "test") throw new Error("This Paystack operation requires Test Mode.");
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

export function requirePaystackLiveRefundsEnabled() {
  const config = getPaystackLiveConfig(false);
  if (!config.liveRefundsEnabled) throw new Error("Paystack live refunds are disabled.");
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

export async function verifyPaystackCompanyTransaction(reference: string, expectedDomain: PaystackDomain) {
  if (!/^CP-[A-F0-9]{32}$/.test(reference)) throw new Error("Invalid company payment reference.");
  const config = getPaystackConfig(false);
  if (config.mode !== expectedDomain) throw new Error("Paystack environment does not match this company payment.");
  const { secretKey } = config;
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey}` }, cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  const result = await response.json().catch(() => null) as { status?: unknown; data?: Record<string, unknown> } | null;
  const data = result?.data;
  const transactionId = typeof data?.id === "number" && Number.isSafeInteger(data.id) ? String(data.id)
    : typeof data?.id === "string" && /^\d+$/.test(data.id) ? data.id : "";
  const amountMinor = typeof data?.amount === "number" ? data.amount : typeof data?.amount === "string" && /^\d+$/.test(data.amount) ? Number(data.amount) : NaN;
  const requestedAmountMinor = typeof data?.requested_amount === "number" ? data.requested_amount
    : typeof data?.requested_amount === "string" && /^\d+$/.test(data.requested_amount) ? Number(data.requested_amount) : NaN;
  if (!response.ok || result?.status !== true || data?.reference !== reference || !transactionId
    || data.status !== "success" || data.domain !== expectedDomain || data.currency !== "NGN"
    || !Number.isSafeInteger(amountMinor) || !Number.isSafeInteger(requestedAmountMinor)
    || requestedAmountMinor <= 0 || amountMinor < requestedAmountMinor) {
    throw new Error("Paystack company payment verification was inconclusive.");
  }
  return { reference, transactionId, amountMinor, requestedAmountMinor, currency: "NGN" as const, domain: expectedDomain };
}

export function verifyPaystackCompanyTestTransaction(reference: string) {
  return verifyPaystackCompanyTransaction(reference, "test");
}

/** Read-only provider evidence; never releases, reserves, or transfers funds. */
export async function verifyPaystackCompanyLiveSettlement(input: CompanySettlementLookup) {
  const { secretKey } = getPaystackLiveConfig(false);
  return verifyCompanySettlementEvidence(input, async (kind, settlementId, page) => {
    const url = kind === "settlements"
      ? `https://api.paystack.co/settlement?status=success&perPage=100&page=${page}`
      : `https://api.paystack.co/settlement/${encodeURIComponent(settlementId)}/transactions?perPage=100&page=${page}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${secretKey}` }, cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("Paystack settlement lookup failed.");
    return response.json().catch(() => { throw new Error("Paystack settlement response was invalid."); });
  });
}

type CompanyReversalLookup = {
  caseId: string;
  transactionId: string;
  transactionReference: string;
  domain: PaystackDomain;
};

async function fetchCompanyReversalRecord(kind: "refund" | "dispute", input: CompanyReversalLookup) {
  if (!/^[1-9]\d*$/.test(input.caseId) || !/^[1-9]\d*$/.test(input.transactionId)
      || !/^CP-[A-F0-9]{32}$/.test(input.transactionReference)) throw new Error("Invalid company reversal lookup.");
  const config = getPaystackConfig(false);
  if (config.mode !== input.domain) throw new Error("Paystack environment does not match this company reversal.");
  const response = await fetch(`https://api.paystack.co/${kind}/${encodeURIComponent(input.caseId)}`, {
    headers: { Authorization: `Bearer ${config.secretKey}` }, cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  const result = await response.json().catch(() => null) as { status?: unknown; data?: unknown } | null;
  if (!response.ok || result?.status !== true) throw new Error("Paystack company reversal lookup failed.");
  const expected = { transactionId: input.transactionId, transactionReference: input.transactionReference, domain: input.domain };
  const verified = kind === "refund"
    ? parseVerifiedPaystackCompanyRefund(result.data, { ...expected, refundId: input.caseId })
    : parseVerifiedPaystackCompanyDispute(result.data, { ...expected, disputeId: input.caseId });
  if (!verified) throw new Error("Paystack company reversal identity or status was inconclusive.");
  return verified;
}

export function verifyPaystackCompanyRefund(input: CompanyReversalLookup) {
  return fetchCompanyReversalRecord("refund", input);
}

export function verifyPaystackCompanyDispute(input: CompanyReversalLookup) {
  return fetchCompanyReversalRecord("dispute", input);
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

export type PaystackRefund = {
  id: string;
  reference: string | null;
  transactionReference: string;
  amountMinor: number;
  currency: "NGN";
  domain: PaystackDomain;
  status: "pending" | "processing" | "needs-attention" | "failed" | "processed";
  payload: Record<string, unknown>;
};

export type PaystackTestRefund = PaystackRefund & { domain: "test" };

function parsePaystackRefund(data: Record<string, unknown>, expectedDomain: PaystackDomain, expected?: { transactionReference: string; transactionId: string }): PaystackRefund {
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
    || !Number.isSafeInteger(amount) || Number(amount) <= 0 || data.currency !== "NGN" || data.domain !== expectedDomain
    || !["pending", "processing", "needs-attention", "failed", "processed"].includes(status)) throw new Error("Paystack refund response was invalid.");
  return { id, reference: typeof data.refund_reference === "string" ? data.refund_reference : null, transactionReference, amountMinor: Number(amount), currency: "NGN", domain: expectedDomain, status: status as PaystackRefund["status"], payload: data };
}

export async function createPaystackTestFullRefund(input: { transactionId: string; transactionReference: string; note: string }) {
  if (!/^\d+$/.test(input.transactionId) || !/^GL-[A-F0-9]{32}$/.test(input.transactionReference)) throw new Error("Invalid refund target.");
  const { secretKey } = requirePaystackTestRefundsEnabled();
  const response = await fetch("https://api.paystack.co/refund", { method: "POST", headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ transaction: input.transactionId, merchant_note: input.note, customer_note: "Growvelt Learning course refund" }), signal: AbortSignal.timeout(15000) });
  const result = await response.json().catch(() => null) as { status?: unknown; message?: unknown; data?: Record<string, unknown> } | null;
  if (!response.ok || result?.status !== true || !result.data) throw new Error(typeof result?.message === "string" ? result.message : "Paystack refund initiation failed.");
  return parsePaystackRefund(result.data, "test", { transactionReference: input.transactionReference, transactionId: input.transactionId }) as PaystackTestRefund;
}

export async function verifyPaystackTestRefund(input: { refundId: string; transactionReference: string; transactionId: string }) {
  if (!/^\d+$/.test(input.refundId) || !/^GL-[A-F0-9]{32}$/.test(input.transactionReference) || !/^\d+$/.test(input.transactionId)) throw new Error("Invalid refund reference.");
  const { secretKey } = getPaystackTestConfig(false);
  const response = await fetch(`https://api.paystack.co/refund/${encodeURIComponent(input.refundId)}`, { headers: { Authorization: `Bearer ${secretKey}` }, cache: "no-store", signal: AbortSignal.timeout(15000) });
  const result = await response.json().catch(() => null) as { status?: unknown; message?: unknown; data?: Record<string, unknown> } | null;
  if (!response.ok || result?.status !== true || !result.data) throw new Error(typeof result?.message === "string" ? result.message : "Paystack refund verification failed.");
  return parsePaystackRefund(result.data, "test", { transactionReference: input.transactionReference, transactionId: input.transactionId }) as PaystackTestRefund;
}

export async function createPaystackLiveFullRefund(input: { transactionId: string; transactionReference: string; note: string }) {
  if (!/^\d+$/.test(input.transactionId) || !/^GL-[A-F0-9]{32}$/.test(input.transactionReference)) throw new Error("Invalid refund target.");
  const { secretKey } = requirePaystackLiveRefundsEnabled();
  const response = await fetch("https://api.paystack.co/refund", { method: "POST", headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ transaction: input.transactionId, merchant_note: input.note, customer_note: "Growvelt Learning course refund" }), signal: AbortSignal.timeout(15000) });
  const result = await response.json().catch(() => null) as { status?: unknown; message?: unknown; data?: Record<string, unknown> } | null;
  if (!response.ok || result?.status !== true || !result.data) throw new Error(typeof result?.message === "string" ? result.message : "Paystack refund initiation failed.");
  return parsePaystackRefund(result.data, "live", { transactionReference: input.transactionReference, transactionId: input.transactionId });
}

export async function verifyPaystackLiveRefund(input: { refundId: string; transactionReference: string; transactionId: string }) {
  if (!/^\d+$/.test(input.refundId) || !/^GL-[A-F0-9]{32}$/.test(input.transactionReference) || !/^\d+$/.test(input.transactionId)) throw new Error("Invalid refund reference.");
  const { secretKey } = getPaystackLiveConfig(false);
  const response = await fetch(`https://api.paystack.co/refund/${encodeURIComponent(input.refundId)}`, { headers: { Authorization: `Bearer ${secretKey}` }, cache: "no-store", signal: AbortSignal.timeout(15000) });
  const result = await response.json().catch(() => null) as { status?: unknown; message?: unknown; data?: Record<string, unknown> } | null;
  if (!response.ok || result?.status !== true || !result.data) throw new Error(typeof result?.message === "string" ? result.message : "Paystack refund verification failed.");
  return parsePaystackRefund(result.data, "live", { transactionReference: input.transactionReference, transactionId: input.transactionId });
}

export type PaystackDispute = { id: string; transactionReference: string; amountMinor: number; currency: "NGN"; domain: PaystackDomain; status: string; resolution: string | null; category: string | null; reason: string | null; deadline: string | null; payload: Record<string, unknown> };
export type PaystackTestDispute = PaystackDispute & { domain: "test" };

async function verifyPaystackDisputeForDomain(input: { disputeId: string; transactionReference: string }, expectedDomain: PaystackDomain): Promise<PaystackDispute> {
  if (!/^\d+$/.test(input.disputeId) || !/^GL-[A-F0-9]{32}$/.test(input.transactionReference)) throw new Error("Invalid dispute reference.");
  const { secretKey } = expectedDomain === "test" ? getPaystackTestConfig(false) : getPaystackLiveConfig(false);
  const response = await fetch(`https://api.paystack.co/dispute/${encodeURIComponent(input.disputeId)}`, { headers: { Authorization: `Bearer ${secretKey}` }, cache: "no-store", signal: AbortSignal.timeout(15000) });
  const result = await response.json().catch(() => null) as { status?: unknown; message?: unknown; data?: Record<string, unknown> } | null;
  const data = result?.data; const transaction = data?.transaction && typeof data.transaction === "object" ? data.transaction as Record<string, unknown> : {};
  const id = typeof data?.id === "number" && Number.isSafeInteger(data.id) ? String(data.id) : typeof data?.id === "string" && /^\d+$/.test(data.id) ? data.id : "";
  const reference = typeof data?.transaction_reference === "string" ? data.transaction_reference : typeof transaction.reference === "string" ? transaction.reference : "";
  const amountValue = data?.refund_amount ?? data?.amount ?? transaction.amount; const amount = typeof amountValue === "string" && /^\d+$/.test(amountValue) ? Number(amountValue) : amountValue;
  const currency = data?.currency ?? transaction.currency; const domain = data?.domain ?? transaction.domain;
  if (!response.ok || result?.status !== true || !data || id !== input.disputeId || reference !== input.transactionReference || !Number.isSafeInteger(amount) || Number(amount)<=0 || currency!=="NGN" || domain!==expectedDomain || typeof data.status!=="string") throw new Error(typeof result?.message === "string" ? result.message : "Paystack dispute verification failed.");
  const deadlineValue=data.due_at??data.dueAt??data.deadline; const deadline=typeof deadlineValue==="string"&&!Number.isNaN(Date.parse(deadlineValue))?new Date(deadlineValue).toISOString():null;
  return { id,transactionReference:reference,amountMinor:Number(amount),currency:"NGN",domain:expectedDomain,status:data.status,resolution:typeof data.resolution==="string"?data.resolution:null,category:typeof data.category==="string"?data.category:null,reason:typeof data.reason==="string"?data.reason:typeof data.note==="string"?data.note:null,deadline,payload:data };
}

export async function verifyPaystackTestDispute(input: { disputeId: string; transactionReference: string }): Promise<PaystackTestDispute> {
  return await verifyPaystackDisputeForDomain(input, "test") as PaystackTestDispute;
}

export async function verifyPaystackLiveDispute(input: { disputeId: string; transactionReference: string }): Promise<PaystackDispute> {
  return verifyPaystackDisputeForDomain(input, "live");
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

export type PaystackTestTransfer = { transferId: string; transferCode: string | null; reference: string; status: string; amountMinor: number; currency: "NGN"; domain: "test" };

/** Server-only: the caller supplies only values loaded from the authoritative payout item. */
export async function initiatePaystackTestTransfer(input: { recipientCode: string; amountMinor: number; reference: string }): Promise<PaystackTestTransfer> {
  if (!/^RCP_[A-Za-z0-9]+$/.test(input.recipientCode) || !Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0 || !/^lpi-[a-z0-9_-]{12,50}$/.test(input.reference)) throw new Error("Invalid Test transfer identity.");
  const { secretKey } = getPaystackTestConfig(false);
  const response = await fetch("https://api.paystack.co/transfer", {
    method: "POST", headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" }, cache: "no-store",
    body: JSON.stringify({ source: "balance", amount: input.amountMinor, recipient: input.recipientCode, reference: input.reference, currency: "NGN", reason: "Growvelt Learning instructor earnings" }), signal: AbortSignal.timeout(15000),
  });
  const result = await response.json().catch(() => null) as { status?: unknown; message?: unknown; data?: Record<string, unknown> } | null;
  const data = result?.data;
  const transferId = typeof data?.id === "number" && Number.isSafeInteger(data.id) ? String(data.id) : typeof data?.id === "string" && /^\d+$/.test(data.id) ? data.id : "";
  const transferCode = typeof data?.transfer_code === "string" && /^TRF_[A-Za-z0-9]+$/.test(data.transfer_code) ? data.transfer_code : null;
  const amount = typeof data?.amount === "number" ? data.amount : typeof data?.amount === "string" && /^\d+$/.test(data.amount) ? Number(data.amount) : NaN;
  const status = typeof data?.status === "string" ? data.status : "";
  if (!response.ok || result?.status !== true || !transferId || data?.reference !== input.reference || amount !== input.amountMinor || data?.currency !== "NGN" || data?.domain !== "test" || !status) throw new Error(typeof result?.message === "string" ? result.message : "Paystack Test transfer initiation failed.");
  return { transferId, transferCode, reference: input.reference, status, amountMinor: amount, currency: "NGN", domain: "test" };
}

export async function verifyPaystackTestTransfer(reference: string): Promise<PaystackTestTransfer> {
  if (!/^lpi-[a-z0-9_-]{12,50}$/.test(reference)) throw new Error("Invalid Test transfer reference.");
  const { secretKey } = getPaystackTestConfig(false);
  const response = await fetch(`https://api.paystack.co/transfer/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${secretKey}` }, cache: "no-store", signal: AbortSignal.timeout(15000) });
  const result = await response.json().catch(() => null) as { status?: unknown; message?: unknown; data?: Record<string, unknown> } | null;
  const data = result?.data;
  const transferId = typeof data?.id === "number" && Number.isSafeInteger(data.id) ? String(data.id) : typeof data?.id === "string" && /^\d+$/.test(data.id) ? data.id : "";
  const transferCode = typeof data?.transfer_code === "string" && /^TRF_[A-Za-z0-9]+$/.test(data.transfer_code) ? data.transfer_code : null;
  const amount = typeof data?.amount === "number" ? data.amount : typeof data?.amount === "string" && /^\d+$/.test(data.amount) ? Number(data.amount) : NaN;
  const rawStatus = typeof data?.status === "string" ? data.status : "";
  const status = rawStatus === "success" ? "succeeded" : rawStatus === "failed" ? "failed" : rawStatus === "reversed" ? "reversed" : rawStatus === "pending" || rawStatus === "otp" ? "pending" : "";
  if (!response.ok || result?.status !== true || !transferId || data?.reference !== reference || !status || !Number.isSafeInteger(amount) || amount <= 0 || data?.currency !== "NGN" || data?.domain !== "test") throw new Error(typeof result?.message === "string" ? result.message : "Paystack Test transfer verification is inconclusive.");
  return { transferId, transferCode, reference, status, amountMinor: amount, currency: "NGN", domain: "test" };
}
