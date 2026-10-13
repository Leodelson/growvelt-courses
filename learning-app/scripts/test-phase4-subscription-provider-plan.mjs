import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildPaystackTestPlanRequest, parsePaystackCreatedTestPlan } from "../app/lib/payments/paystack-subscription-core.ts";

const request = buildPaystackTestPlanRequest({ name: "  Monthly Data Skills  ", description: "  Test plan  ", amountMinor: 5000 });
assert.deepEqual(request, {
  name: "Monthly Data Skills",
  amount: 5000,
  interval: "monthly",
  currency: "NGN",
  send_invoices: false,
  send_sms: false,
  description: "Test plan",
});
assert.throws(() => buildPaystackTestPlanRequest({ name: "x", amountMinor: 5000 }));
assert.throws(() => buildPaystackTestPlanRequest({ name: "Valid name", amountMinor: 0 }));
assert.throws(() => buildPaystackTestPlanRequest({ name: "Valid name", amountMinor: Number.MAX_SAFE_INTEGER + 1 }));

const validResponse = {
  status: true,
  data: { plan_code: "PLN_gx2wn530m0i3w3m", name: "Monthly Data Skills", amount: 5000, interval: "monthly", currency: "NGN", domain: "test" },
};
assert.deepEqual(parsePaystackCreatedTestPlan(validResponse, { name: "Monthly Data Skills", amountMinor: 5000 }), {
  planCode: "PLN_gx2wn530m0i3w3m", name: "Monthly Data Skills", amountMinor: 5000,
  interval: "monthly", currency: "NGN", domain: "test",
});
for (const changed of [
  { ...validResponse, status: false },
  { status: true, data: { ...validResponse.data, domain: "live" } },
  { status: true, data: { ...validResponse.data, currency: "USD" } },
  { status: true, data: { ...validResponse.data, interval: "annually" } },
  { status: true, data: { ...validResponse.data, amount: 5001 } },
  { status: true, data: { ...validResponse.data, name: "Different plan" } },
  { status: true, data: { ...validResponse.data, plan_code: "bad-code" } },
  null,
]) {
  assert.equal(parsePaystackCreatedTestPlan(changed, { name: "Monthly Data Skills", amountMinor: 5000 }), null);
}

const adapter = await readFile(new URL("../app/lib/payments/paystack-subscriptions.ts", import.meta.url), "utf8");
assert.match(adapter, /GROWVELT_LEARNING_SUBSCRIPTIONS_ENABLED !== "true"/);
assert.match(adapter, /GROWVELT_LEARNING_SUBSCRIPTION_TEST_PLAN_CREATION_ENABLED !== "true"/);
assert.match(adapter, /getPaystackTestConfig\(false\)/);
assert.doesNotMatch(adapter, /getPaystackLiveConfig|PAYSTACK_LIVE_SECRET_KEY/);

const action = await readFile(new URL("../app/dashboard/instructor/subscriptions/actions.ts", import.meta.url), "utf8");
assert.match(action, /canProvisionTestSubscriptionPlans\(\)/);
assert.match(action, /supabase\.auth\.getUser\(\)/);
assert.match(action, /is_approved_growvelt_instructor/);
assert.match(action, /createAdminClient\(\)/);
assert.match(action, /claim_own_learning_subscription_plan_provisioning/);
assert.match(action, /record_own_learning_subscription_plan_provisioning/);
assert.match(action, /finish_own_learning_subscription_plan_provisioning/);
assert.ok(action.indexOf("claim_own_learning_subscription_plan_provisioning")
  < action.indexOf("createPaystackTestSubscriptionPlan("), "claim must succeed before any provider call");
assert.ok(action.indexOf("createPaystackTestSubscriptionPlan(")
  < action.indexOf("record_own_learning_subscription_plan_provisioning"), "provider result must be recorded only after creation");
assert.match(action, /outcome === "provider_rejected"/);
assert.match(action, /Do not retry; an admin must reconcile it first/);

const page = await readFile(new URL("../app/dashboard/instructor/subscriptions/page.tsx", import.meta.url), "utf8");
assert.match(page, /Check setup status/);
assert.match(page, /Retry Test Mode plan setup/);
assert.match(page, /canCreateTestPlans && plan\.status === "draft"/);

console.log("PASS subscription plan request validation, Test Mode response checks, default-off gates, and claim-before-provider instructor action");
