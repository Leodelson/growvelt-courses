import "server-only";
import { getPaystackTestConfig } from "@/app/lib/payments/paystack";
import { buildPaystackTestPlanRequest, buildPaystackTestSubscriptionCheckoutRequest, parsePaystackCreatedTestPlan, parsePaystackTestSubscriptionCheckoutResponse } from "@/app/lib/payments/paystack-subscription-core";

export class PaystackTestPlanCreateError extends Error {
  constructor(readonly disposition: "rejected" | "ambiguous") {
    super(disposition === "rejected"
      ? "Paystack rejected the Test Mode plan request."
      : "Paystack plan creation could not be confirmed.");
    this.name = "PaystackTestPlanCreateError";
  }
}

export class PaystackTestSubscriptionCheckoutError extends Error {
  constructor(readonly disposition: "rejected" | "ambiguous") {
    super(disposition === "rejected"
      ? "Paystack rejected the Test Mode subscription checkout."
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
    throw new Error("Test subscription checkout is disabled.");
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
    throw new PaystackTestSubscriptionCheckoutError("rejected");
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
    throw new Error("Test subscription plan creation is disabled.");
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
