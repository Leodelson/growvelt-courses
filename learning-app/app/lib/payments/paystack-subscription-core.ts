export type PaystackSubscriptionPlanDraft = {
  name: string;
  description?: string | null;
  amountMinor: number;
};

export type PaystackCreatePlanRequest = {
  name: string;
  amount: number;
  interval: "monthly";
  currency: "NGN";
  send_invoices: false;
  send_sms: false;
  description?: string;
};

export type PaystackCreatedTestPlan = {
  planCode: string;
  name: string;
  amountMinor: number;
  interval: "monthly";
  currency: "NGN";
  domain: "test";
};

export type PaystackTestSubscriptionCheckoutRequest = {
  email: string;
  amount: string;
  currency: "NGN";
  reference: string;
  plan: string;
  callback_url: string;
  metadata: {
    product: "growvelt_learning_subscription";
    environment: "test";
    subscription_id: string;
    invoice_id: string;
  };
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLAN_CODE_PATTERN = /^PLN_[A-Za-z0-9]{8,100}$/;
const SUBSCRIPTION_CODE_PATTERN = /^SUB_[A-Za-z0-9]{8,100}$/;
const INVOICE_CODE_PATTERN = /^INV_[A-Za-z0-9]{8,100}$/;

function isTrustedPaystackCheckoutUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "checkout.paystack.com"
      && !url.username && !url.password;
  } catch {
    return false;
  }
}

/**
 * Keeps provider rejection diagnostics useful without copying arbitrary
 * response content into application logs. The provider message is bounded,
 * flattened, and stripped of common credential, email, and long-number forms.
 */
export function sanitizePaystackProviderMessage(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const message = value
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\bsk_(?:test|live)_[A-Za-z0-9_-]+\b/gi, "[redacted-key]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
    .replace(/\b(?:\d[ -]?){7,19}\b/g, "[redacted-number]")
    .slice(0, 240);

  return message || null;
}

/**
 * Builds only the initial, Test Mode subscription transaction request.
 * Paystack's `plan` field is authoritative for the recurring amount; the
 * locally supplied amount is included for an explicit matching request and
 * must already have been read from the server-owned plan row.
 */
export function buildPaystackTestSubscriptionCheckoutRequest(input: {
  email: string;
  amountMinor: number;
  reference: string;
  planCode: string;
  callbackUrl: string;
  subscriptionId: string;
  invoiceId: string;
}): PaystackTestSubscriptionCheckoutRequest {
  const email = input.email.trim();
  let callbackUrl: URL;
  try {
    callbackUrl = new URL(input.callbackUrl);
  } catch {
    throw new Error("A valid subscription payment callback URL is required.");
  }

  const localHttpAllowed = callbackUrl.protocol === "http:"
    && ["localhost", "127.0.0.1", "::1"].includes(callbackUrl.hostname);
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || !Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0
    || !/^GS-[A-F0-9]{32}$/.test(input.reference)
    || !PLAN_CODE_PATTERN.test(input.planCode)
    || !UUID_PATTERN.test(input.subscriptionId) || !UUID_PATTERN.test(input.invoiceId)
    || !["https:", ...(localHttpAllowed ? ["http:"] : [])].includes(callbackUrl.protocol)
    || callbackUrl.username || callbackUrl.password) {
    throw new Error("A valid Test Mode subscription checkout is required.");
  }

  return {
    email,
    amount: String(input.amountMinor),
    currency: "NGN",
    reference: input.reference,
    plan: input.planCode,
    callback_url: callbackUrl.toString(),
    metadata: {
      product: "growvelt_learning_subscription",
      environment: "test",
      subscription_id: input.subscriptionId,
      invoice_id: input.invoiceId,
    },
  };
}

export function parsePaystackTestSubscriptionCheckoutResponse(
  value: unknown,
  expectedReference: string,
): { authorizationUrl: string; accessCode: string; reference: string } | null {
  if (!value || typeof value !== "object") return null;
  const response = value as Record<string, unknown>;
  const data = response.data && typeof response.data === "object"
    ? response.data as Record<string, unknown>
    : null;
  if (response.status !== true || !data
    || data.reference !== expectedReference
    || typeof data.authorization_url !== "string"
    || !isTrustedPaystackCheckoutUrl(data.authorization_url)
    || typeof data.access_code !== "string"
    || !/^[A-Za-z0-9_-]{6,160}$/.test(data.access_code)) return null;

  return {
    authorizationUrl: data.authorization_url,
    accessCode: data.access_code,
    reference: expectedReference,
  };
}

export type PaystackTestSubscriptionWebhookEvent =
  | {
    kind: "initial_charge_success";
    eventId: string;
    reference: string;
    transactionId: string;
    amountMinor: number;
    currency: "NGN";
    paymentDomain: "test";
    subscriptionCode: string | null;
  }
  | {
    kind: "renewal_charge_success";
    eventId: string;
    reference: string;
    transactionId: string;
    amountMinor: number;
    currency: "NGN";
    paymentDomain: "test";
    subscriptionCode: string;
  }
  | {
    kind: "invoice_create" | "invoice_payment_failed" | "invoice_update";
    eventId: string;
    invoiceCode: string;
    subscriptionCode: string;
    amountMinor: number;
    currency: "NGN";
    paymentDomain: "test";
    status: string;
    periodStartsAt: string | null;
    paidThrough: string | null;
    transactionReference: string | null;
  }
  | {
    kind: "subscription_create" | "subscription_not_renew" | "subscription_disable";
    eventId: string;
    subscriptionCode: string;
    paymentDomain: "test";
    status: string | null;
    planCode: string | null;
    customerCode: string | null;
    customerEmail: string | null;
  };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nonEmptyString(value: unknown, maximumLength = 160): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= maximumLength && value.trim() === value
    ? value
    : null;
}

function providerCode(value: unknown, pattern: RegExp): string | null {
  const code = nonEmptyString(value);
  return code && pattern.test(code) ? code : null;
}

function positiveMinor(value: unknown): number | null {
  const amount = typeof value === "number" ? value
    : typeof value === "string" && /^\d+$/.test(value) ? Number(value)
      : NaN;
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

function providerTransactionId(value: unknown): string | null {
  const id = typeof value === "number" && Number.isSafeInteger(value) ? String(value)
    : typeof value === "string" ? value
      : "";
  return /^[1-9][0-9]{0,39}$/.test(id) ? id : null;
}

function nestedSubscription(data: Record<string, unknown>) {
  return asRecord(data.subscription);
}

function getSubscriptionCode(data: Record<string, unknown>): string | null {
  const subscription = nestedSubscription(data);
  return providerCode(data.subscription_code ?? subscription?.subscription_code, SUBSCRIPTION_CODE_PATTERN);
}

function getCustomerCode(data: Record<string, unknown>): string | null {
  const customer = asRecord(data.customer);
  return nonEmptyString(customer?.customer_code, 100);
}

function getCustomerEmail(data: Record<string, unknown>): string | null {
  const customer = asRecord(data.customer);
  const email = nonEmptyString(customer?.email, 254);
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.toLowerCase() : null;
}

function getPlanCode(data: Record<string, unknown>): string | null {
  const direct = providerCode(data.plan_code, PLAN_CODE_PATTERN);
  const plan = asRecord(data.plan);
  return direct ?? providerCode(plan?.plan_code, PLAN_CODE_PATTERN);
}

/**
 * Normalizes only known Test Mode subscription lifecycle events. The caller
 * must first verify the HMAC over the untouched raw request body. A normalized
 * charge is still just an event: its transaction must be independently
 * verified with Paystack before any invoice is marked paid or access granted.
 */
export function parsePaystackTestSubscriptionWebhook(value: unknown): PaystackTestSubscriptionWebhookEvent | null {
  const root = asRecord(value);
  const data = asRecord(root?.data);
  const event = nonEmptyString(root?.event, 100);
  if (!data || !event || (data.domain !== undefined && data.domain !== "test")) return null;

  if (event === "charge.success") {
    const reference = nonEmptyString(data.reference, 100);
    const transactionId = providerTransactionId(data.id);
    const amountMinor = positiveMinor(data.amount);
    const subscriptionCode = getSubscriptionCode(data);
    if (!reference || !transactionId || !amountMinor || data.status !== "success" || data.currency !== "NGN") return null;
    if (/^GS-[A-F0-9]{32}$/.test(reference)) {
      return {
        kind: "initial_charge_success",
        eventId: `charge.success:transaction:${transactionId}`,
        reference,
        transactionId,
        amountMinor,
        currency: "NGN",
        paymentDomain: "test",
        subscriptionCode,
      };
    }
    if (subscriptionCode) {
      return {
        kind: "renewal_charge_success",
        eventId: `charge.success:transaction:${transactionId}`,
        reference,
        transactionId,
        amountMinor,
        currency: "NGN",
        paymentDomain: "test",
        subscriptionCode,
      };
    }
    return null;
  }

  if (["invoice.create", "invoice.payment_failed", "invoice.update"].includes(event)) {
    const invoiceCode = providerCode(data.invoice_code, INVOICE_CODE_PATTERN);
    const subscriptionCode = getSubscriptionCode(data);
    const amountMinor = positiveMinor(data.amount);
    const status = nonEmptyString(data.status, 40);
    const periodStartsAt = nonEmptyString(data.period_start, 80);
    const paidThrough = nonEmptyString(data.period_end, 80);
    const transaction = asRecord(data.transaction);
    const transactionReference = nonEmptyString(transaction?.reference, 100);
    if (!invoiceCode || !subscriptionCode || !amountMinor || !status || data.currency !== undefined && data.currency !== "NGN") return null;
    const kind = event === "invoice.create" ? "invoice_create"
      : event === "invoice.payment_failed" ? "invoice_payment_failed"
        : "invoice_update";
    return {
      kind,
      eventId: `${event}:invoice:${invoiceCode}:status:${status}`,
      invoiceCode,
      subscriptionCode,
      amountMinor,
      currency: "NGN",
      paymentDomain: "test",
      status,
      periodStartsAt,
      paidThrough,
      transactionReference,
    };
  }

  if (["subscription.create", "subscription.not_renew", "subscription.disable"].includes(event)) {
    const subscription = nestedSubscription(data);
    const subscriptionCode = getSubscriptionCode(data)
      ?? providerCode(subscription?.code, SUBSCRIPTION_CODE_PATTERN);
    if (!subscriptionCode) return null;
    const status = nonEmptyString(data.status ?? subscription?.status, 40);
    const planCode = getPlanCode(data) ?? getPlanCode(subscription ?? {});
    const customerCode = getCustomerCode(data);
    const kind = event === "subscription.create" ? "subscription_create"
      : event === "subscription.not_renew" ? "subscription_not_renew"
        : "subscription_disable";
    return {
      kind,
      eventId: `${event}:subscription:${subscriptionCode}${status ? `:status:${status}` : ""}`,
      subscriptionCode,
      paymentDomain: "test",
      status,
      planCode,
      customerCode,
      customerEmail: getCustomerEmail(data),
    };
  }

  return null;
}

export function buildPaystackTestPlanRequest(input: PaystackSubscriptionPlanDraft): PaystackCreatePlanRequest {
  const name = input.name.trim();
  const description = input.description?.trim();
  if (name.length < 3 || name.length > 100 || (description && description.length > 1000)
    || !Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error("A valid monthly NGN subscription plan is required.");
  }

  return {
    name,
    amount: input.amountMinor,
    interval: "monthly",
    currency: "NGN",
    // Growvelt sends its own transactional and renewal notices; avoid duplicate
    // provider invoices/SMS while the product lifecycle is being validated.
    send_invoices: false,
    send_sms: false,
    ...(description ? { description } : {}),
  };
}

export function parsePaystackCreatedTestPlan(
  value: unknown,
  expected: { name: string; amountMinor: number },
): PaystackCreatedTestPlan | null {
  if (!value || typeof value !== "object") return null;
  const response = value as Record<string, unknown>;
  const data = response.data && typeof response.data === "object"
    ? response.data as Record<string, unknown>
    : null;
  if (response.status !== true || !data) return null;

  const amount = typeof data.amount === "string" && /^\d+$/.test(data.amount)
    ? Number(data.amount)
    : data.amount;
  if (typeof data.plan_code !== "string" || !/^PLN_[A-Za-z0-9]{8,100}$/.test(data.plan_code)
    || data.name !== expected.name || amount !== expected.amountMinor
    || data.interval !== "monthly" || data.currency !== "NGN" || data.domain !== "test") {
    return null;
  }

  return {
    planCode: data.plan_code,
    name: expected.name,
    amountMinor: expected.amountMinor,
    interval: "monthly",
    currency: "NGN",
    domain: "test",
  };
}

/** Validates the provider-hosted subscription management link before redirecting a learner. */
export function parsePaystackTestSubscriptionManagementLink(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const response = value as Record<string, unknown>;
  const data = response.data && typeof response.data === "object"
    ? response.data as Record<string, unknown>
    : null;
  if (response.status !== true || !data || typeof data.link !== "string" || data.link.length > 8192) return null;

  try {
    const link = new URL(data.link);
    const token = link.searchParams.get("subscription_token");
    if (link.protocol !== "https:" || link.hostname !== "paystack.com"
      || link.username || link.password || link.hash
      || !/^\/manage\/subscriptions\/[A-Za-z0-9_-]{6,160}\/?$/.test(link.pathname)
      || !token || token.length > 4096) return null;
    return link.toString();
  } catch {
    return null;
  }
}

/**
 * Narrows a Paystack Test Mode subscription-list response to entries that
 * exactly match one authenticated learner's email and local plan terms.
 * Codes are returned only to server-side callers and never to the browser.
 */
export function parsePaystackTestSubscriptionListPage(
  value: unknown,
  expected: { email: string; planCode: string; amountMinor: number },
): { subscriptionCodes: string[]; page: number; pageCount: number } | null {
  const response = asRecord(value);
  const meta = asRecord(response?.meta);
  const data = response?.data;
  const page = meta?.page;
  const pageCount = meta?.pageCount;
  const email = expected.email.trim().toLowerCase();
  if (response?.status !== true || !Array.isArray(data)
    || !Number.isSafeInteger(page) || (page as number) < 1
    || !Number.isSafeInteger(pageCount) || (pageCount as number) < 1
    || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || !PLAN_CODE_PATTERN.test(expected.planCode)
    || !Number.isSafeInteger(expected.amountMinor) || expected.amountMinor <= 0) return null;

  const subscriptionCodes = new Set<string>();
  for (const value of data) {
    const subscription = asRecord(value);
    const customer = asRecord(subscription?.customer);
    const plan = asRecord(subscription?.plan);
    if (!subscription || !customer || !plan) continue;
    const customerEmail = typeof customer.email === "string" ? customer.email.trim().toLowerCase() : "";
    const amount = positiveMinor(subscription.amount);
    const planAmount = positiveMinor(plan.amount);
    const code = providerCode(subscription.subscription_code, SUBSCRIPTION_CODE_PATTERN);
    const customerDomain = customer.domain;
    if (subscription.domain !== "test" || plan.domain !== "test"
      || customerDomain !== undefined && customerDomain !== "test"
      || customerEmail !== email || plan.plan_code !== expected.planCode
      || subscription.status !== "active" && subscription.status !== "attention"
      || plan.currency !== "NGN" || plan.interval !== "monthly"
      || amount !== expected.amountMinor || planAmount !== expected.amountMinor || !code) continue;
    subscriptionCodes.add(code);
  }

  return { subscriptionCodes: [...subscriptionCodes], page: page as number, pageCount: pageCount as number };
}
