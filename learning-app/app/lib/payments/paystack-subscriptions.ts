import "server-only";
import { getPaystackTestConfig } from "@/app/lib/payments/paystack";
import { buildPaystackTestPlanRequest, buildPaystackTestSubscriptionCheckoutRequest, parsePaystackCreatedTestPlan, parsePaystackTestSubscriptionCheckoutResponse, parsePaystackTestSubscriptionListPage, parsePaystackTestSubscriptionManagementLink, sanitizePaystackProviderMessage } from "@/app/lib/payments/paystack-subscription-core";

export class PaystackTestPlanCreateError extends Error {
  constructor(readonly disposition: "rejected" | "ambiguous") {
    super(disposition === "rejected"
      ? "Paystack rejected the Sandbox Mode plan request."
      : "Paystack plan creation could not be confirmed.");
    this.name = "PaystackTestPlanCreateError";
  }
}

export class PaystackTestSubscriptionCheckoutError extends Error {
  constructor(
    readonly disposition: "rejected" | "ambiguous",
    readonly providerHttpStatus?: number,
    readonly providerMessage?: string | null,
  ) {
    super(disposition === "rejected"
      ? "Paystack rejected the Sandbox Mode subscription checkout."
      : "Paystack subscription checkout could not be confirmed.");
    this.name = "PaystackTestSubscriptionCheckoutError";
  }
}

export async function initializePaystackTestSubscriptionCheckout(input: {
  email: string;
  amountMinor: number;
  reference: string;
  planCode: string;
  callbackUrl: string;
  subscriptionId: string;
  invoiceId: string;
}) {
  if (process.env.GROWVELT_LEARNING_SUBSCRIPTIONS_ENABLED !== "true"
    || process.env.GROWVELT_LEARNING_SUBSCRIPTION_TEST_CHECKOUT_ENABLED !== "true"
    || process.env.GROWVELT_LEARNING_SUBSCRIPTION_TEST_LIFECYCLE_ENABLED !== "true") {
    throw new Error("Sandbox subscription checkout is disabled.");
  }
  const { secretKey } = getPaystackTestConfig(true);
  const body = buildPaystackTestSubscriptionCheckoutRequest(input);
  let response: Response;
  try {
    response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new PaystackTestSubscriptionCheckoutError("ambiguous");
  }
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok && result && typeof result === "object"
    && (result as Record<string, unknown>).status === false) {
    const providerMessage = sanitizePaystackProviderMessage((result as Record<string, unknown>).message);
    throw new PaystackTestSubscriptionCheckoutError("rejected", response.status, providerMessage);
  }
  const checkout = parsePaystackTestSubscriptionCheckoutResponse(result, input.reference);
  if (!response.ok || !checkout) throw new PaystackTestSubscriptionCheckoutError("ambiguous");
  return checkout;
}

/**
 * Creates a Test Mode plan only. Callers must separately enforce their
 * instructor authorization and idempotent database claim before reaching
 * Paystack. Never call it from a browser or without the server action's claim.
 */
export async function createPaystackTestSubscriptionPlan(input: {
  name: string;
  description?: string | null;
  amountMinor: number;
}) {
  if (process.env.GROWVELT_LEARNING_SUBSCRIPTIONS_ENABLED !== "true"
    || process.env.GROWVELT_LEARNING_SUBSCRIPTION_TEST_PLAN_CREATION_ENABLED !== "true") {
    throw new Error("Sandbox subscription plan creation is disabled.");
  }

  const { secretKey } = getPaystackTestConfig(false);
  const body = buildPaystackTestPlanRequest(input);
  let response: Response;
  try {
    response = await fetch("https://api.paystack.co/plan", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new PaystackTestPlanCreateError("ambiguous");
  }
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok && result && typeof result === "object"
    && (result as Record<string, unknown>).status === false) {
    throw new PaystackTestPlanCreateError("rejected");
  }
  const plan = parsePaystackCreatedTestPlan(result, { name: body.name, amountMinor: body.amount });
  if (!response.ok || !plan) throw new PaystackTestPlanCreateError("ambiguous");
  return plan;
}

/** Requests a hosted management link for one existing Test Mode subscription. */
export async function getPaystackTestSubscriptionManagementLink(subscriptionCode: string) {
  if (!/^SUB_[A-Za-z0-9]{8,100}$/.test(subscriptionCode)) {
    throw new Error("A valid Sandbox Mode subscription is required.");
  }
  const { secretKey } = getPaystackTestConfig(false);
  let response: Response;
  try {
    response = await fetch(`https://api.paystack.co/subscription/${encodeURIComponent(subscriptionCode)}/manage/link`, {
      method: "GET",
      headers: { Authorization: `Bearer ${secretKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error("Paystack subscription management is temporarily unavailable.");
  }
  const result: unknown = await response.json().catch(() => null);
  const link = parsePaystackTestSubscriptionManagementLink(result);
  if (!response.ok || !link) throw new Error("Paystack did not return a valid subscription management link.");
  return link;
}

/**
 * Recovers a missing Test Mode provider mapping without writing provider data
 * into Growvelt. Each result is constrained to one learner, plan, amount, and
 * active provider subscription; ambiguous or oversized inventories fail closed.
 */
export async function findPaystackTestSubscriptionCode(input: {
  email: string;
  planCode: string;
  amountMinor: number;
}) {
  const email = input.email.trim().toLowerCase();
  if (!email || !/^PLN_[A-Za-z0-9]{8,100}$/.test(input.planCode)
    || !Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error("A matching Sandbox Mode subscription could not be confirmed.");
  }

  const { secretKey } = getPaystackTestConfig(false);
  const pageSize = 100;
  const maximumPages = 5;
  const matches = new Set<string>();
  let pageCount: number | null = null;

  for (let page = 1; page <= (pageCount ?? 1); page += 1) {
    let response: Response;
    try {
      response = await fetch(`https://api.paystack.co/subscription?perPage=${pageSize}&page=${page}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${secretKey}` },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new Error("Paystack subscription lookup is temporarily unavailable.");
    }
    const result: unknown = await response.json().catch(() => null);
    const parsed = parsePaystackTestSubscriptionListPage(result, {
      email,
      planCode: input.planCode,
      amountMinor: input.amountMinor,
    });
    if (!response.ok || !parsed || parsed.page !== page
      || pageCount !== null && parsed.pageCount !== pageCount
      || parsed.pageCount > maximumPages) {
      throw new Error("Paystack subscription lookup could not safely identify this subscription.");
    }
    pageCount = parsed.pageCount;
    for (const code of parsed.subscriptionCodes) matches.add(code);
    if (matches.size > 1) throw new Error("Multiple matching Paystack subscriptions need review.");
  }

  const [subscriptionCode] = matches;
  if (!subscriptionCode) throw new Error("Paystack has not provided a matching active subscription.");
  return subscriptionCode;
}
