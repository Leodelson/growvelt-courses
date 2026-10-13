import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isLearningSubscriptionTestLearnerAllowed } from "../app/lib/subscriptions/test-learner-allowlist.ts";

const emailList = "MotivationSteelMgt@gmail.com, other-test@example.com";
assert.equal(isLearningSubscriptionTestLearnerAllowed(" motivationsteelmgt@gmail.com ", emailList), true);
assert.equal(isLearningSubscriptionTestLearnerAllowed("other-test@example.com", emailList), true);
assert.equal(isLearningSubscriptionTestLearnerAllowed("unlisted@example.com", emailList), false);
assert.equal(isLearningSubscriptionTestLearnerAllowed("motivationsteelmgt@gmail.com", undefined), false);
assert.equal(isLearningSubscriptionTestLearnerAllowed(null, emailList), false);

const migration = await readFile(
  new URL("../supabase/migrations/20261029000000_allow_allowlisted_private_test_subscription_checkout.sql", import.meta.url),
  "utf8",
);
assert.match(migration, /get_company_test_learning_subscription_plan_for_checkout/);
assert.match(migration, /plan\.payment_domain = 'test'/);
assert.match(migration, /coalesce\(course\.company_test_mode_only, false\)/);
assert.match(migration, /grant execute on function public\.get_company_test_learning_subscription_plan_for_checkout\(uuid\)\s+to service_role, postgres/i);
assert.match(migration, /not public\.is_paystack_test_fixture_course\(course\.id\)/);
assert.match(migration, /count\(distinct coalesce\(course\.company_test_mode_only, false\)\) = 1/);
assert.match(migration, /attempt_row\.state = 'retryable'/);
assert.match(migration, /needs_reconciliation/);

const checkoutHandler = await readFile(
  new URL("../app/lib/payments/learning-test-subscription-checkout.ts", import.meta.url),
  "utf8",
);
assert.match(checkoutHandler, /options\.privateTestOnly && !canUsePrivateTestSubscriptionCheckout\(user\.email\)/);
assert.match(checkoutHandler, /if \(options\.privateTestOnly\)/);
assert.match(checkoutHandler, /else if \(privatePlan\?\.plan_id === body\.planId\)/);
assert.match(checkoutHandler, /initializePaystackTestSubscriptionCheckout/);

const privatePage = await readFile(
  new URL("../app/dashboard/test-subscriptions/[planId]/page.tsx", import.meta.url),
  "utf8",
);
assert.match(privatePage, /canUsePrivateTestSubscriptionCheckout\(user\.email\)/);
assert.match(privatePage, /get_company_test_learning_subscription_plan_for_checkout/);

console.log("Private subscription Test Mode checkout safeguards passed.");
