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

export function canProvisionTestSubscriptionPlans() {
  if (!areLearningSubscriptionPlansEnabled()
    || process.env.GROWVELT_LEARNING_SUBSCRIPTION_TEST_PLAN_CREATION_ENABLED !== "true") return false;
  try {
    return resolvePaystackConfiguration(process.env).mode === "test";
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
