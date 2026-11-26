import "server-only";
import { resolvePaystackConfiguration } from "@/app/lib/payments/paystack-config";
import { isLearningSubscriptionTestLearnerAllowed } from "@/app/lib/subscriptions/test-learner-allowlist";

export function canUsePrivateTestSubscriptionCheckout(email: string | null | undefined) {
  return isLearningSubscriptionTestLearnerAllowed(
    email,
    process.env.GROWVELT_LEARNING_SUBSCRIPTION_TEST_LEARNER_EMAILS,
  );
}

export function areLearningSubscriptionPlansEnabled() {
  return process.env.GROWVELT_LEARNING_SUBSCRIPTIONS_ENABLED === "true";
}

export function canProcessTestSubscriptionEvents() {
  if (!areLearningSubscriptionPlansEnabled()
    || process.env.GROWVELT_LEARNING_SUBSCRIPTION_TEST_LIFECYCLE_ENABLED !== "true") return false;
  try {
    return resolvePaystackConfiguration(process.env).mode === "test";
  } catch {
    return false;
  }
}

/** Process recurring Live events with a dedicated lifecycle switch. This gate
 * intentionally stays independent from new-checkout availability so existing
 * subscriptions can still renew or cancel after sales are paused.
 */
export function canProcessLiveSubscriptionEvents() {
  if (!areLearningSubscriptionPlansEnabled()
    || process.env.GROWVELT_LEARNING_SUBSCRIPTION_LIVE_LIFECYCLE_ENABLED !== "true") return false;
  try {
    return resolvePaystackConfiguration(process.env).mode === "live";
  } catch {
    return false;
  }
}

export function canProvisionTestSubscriptionPlans() {
  if (!areLearningSubscriptionPlansEnabled()
    || process.env.GROWVELT_LEARNING_SUBSCRIPTION_TEST_PLAN_CREATION_ENABLED !== "true") return false;
  try {
    return resolvePaystackConfiguration(process.env).mode === "test";
  } catch {
    return false;
  }
}

export function canProvisionLiveSubscriptionPlans() {
  if (!areLearningSubscriptionPlansEnabled()
    || process.env.GROWVELT_LEARNING_SUBSCRIPTION_LIVE_PLAN_CREATION_ENABLED !== "true") return false;
  try {
    return resolvePaystackConfiguration(process.env).mode === "live";
  } catch {
    return false;
  }
}

export function canStartTestSubscriptionCheckout() {
  if (!areLearningSubscriptionPlansEnabled()
    || process.env.GROWVELT_LEARNING_SUBSCRIPTION_TEST_CHECKOUT_ENABLED !== "true"
    || process.env.GROWVELT_LEARNING_SUBSCRIPTION_TEST_LIFECYCLE_ENABLED !== "true") return false;
  try {
    return resolvePaystackConfiguration(process.env).mode === "test";
  } catch {
    return false;
  }
}

/** Live subscriptions require a dedicated opt-in in addition to the existing
 * global and Live learner checkout switches. This remains off by default.
 */
export function canStartLiveSubscriptionCheckout() {
  if (!areLearningSubscriptionPlansEnabled()
    || process.env.GROWVELT_LEARNING_SUBSCRIPTION_LIVE_LIFECYCLE_ENABLED !== "true"
    || process.env.GROWVELT_LEARNING_SUBSCRIPTION_LIVE_CHECKOUT_ENABLED !== "true"
    || process.env.PAYMENTS_CHECKOUT_ENABLED !== "true"
    || process.env.PAYMENTS_LIVE_LEARNER_CHECKOUT_ENABLED !== "true") return false;
  try {
    const config = resolvePaystackConfiguration(process.env);
    return config.mode === "live" && config.checkoutEnabled && config.liveLearnerCheckoutEnabled;
  } catch {
    return false;
  }
}
