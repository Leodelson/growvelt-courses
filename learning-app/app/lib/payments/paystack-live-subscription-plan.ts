import "server-only";
import { getPaystackLiveConfig } from "@/app/lib/payments/paystack";
import { buildPaystackPlanRequest, parsePaystackCreatedPlan, type PaystackSubscriptionPlanDraft } from "@/app/lib/payments/paystack-subscription-core";

export class PaystackLivePlanCreateError extends Error {
  constructor(readonly disposition: "rejected" | "ambiguous") {
    super("Live subscription plan creation could not be confirmed.");
    this.name = "PaystackLivePlanCreateError";
  }
}

/** Provider adapter only. The caller must first acquire a durable, unique
 * Live-domain database claim; never call this directly from a browser or UI. */
export async function createPaystackLiveSubscriptionPlan(input: PaystackSubscriptionPlanDraft) {
  if (process.env.GROWVELT_LEARNING_SUBSCRIPTIONS_ENABLED !== "true"
    || process.env.GROWVELT_LEARNING_SUBSCRIPTION_LIVE_PLAN_CREATION_ENABLED !== "true") {
    throw new Error("Live subscription plan creation is disabled.");
  }
  const { secretKey } = getPaystackLiveConfig(false);
  const body = buildPaystackPlanRequest(input);
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
    throw new PaystackLivePlanCreateError("ambiguous");
  }
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok && result && typeof result === "object"
    && (result as Record<string, unknown>).status === false) {
    throw new PaystackLivePlanCreateError("rejected");
  }
  const plan = parsePaystackCreatedPlan(result, { name: body.name, amountMinor: body.amount }, "live");
  if (!response.ok || !plan) throw new PaystackLivePlanCreateError("ambiguous");
  return plan;
}
