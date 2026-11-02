import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildPaystackPlanRequest, parsePaystackCreatedPlan } from "../app/lib/payments/paystack-subscription-core.ts";

const request = buildPaystackPlanRequest({ name: "  Monthly Data Skills  ", amountMinor: 5000 });
assert.equal(request.name, "Monthly Data Skills");
assert.equal(request.amount, 5000);
assert.equal(request.interval, "monthly");
assert.equal(request.currency, "NGN");

const response = {
  status: true,
  data: { plan_code: "PLN_gx2wn530m0i3w3m", name: request.name, amount: request.amount,
    interval: "monthly", currency: "NGN", domain: "live" },
};
const expected = { name: request.name, amountMinor: request.amount };
assert.deepEqual(parsePaystackCreatedPlan(response, expected, "live"), {
  planCode: "PLN_gx2wn530m0i3w3m", name: request.name, amountMinor: request.amount,
  interval: "monthly", currency: "NGN", domain: "live",
});
assert.equal(parsePaystackCreatedPlan(response, expected, "test"), null);
for (const data of [
  { ...response.data, domain: "test" },
  { ...response.data, amount: 5001 },
  { ...response.data, currency: "USD" },
  { ...response.data, plan_code: "bad" },
]) {
  assert.equal(parsePaystackCreatedPlan({ status: true, data }, expected, "live"), null);
}

const adapter = await readFile(new URL("../app/lib/payments/paystack-live-subscription-plan.ts", import.meta.url), "utf8");
assert.match(adapter, /GROWVELT_LEARNING_SUBSCRIPTION_LIVE_PLAN_CREATION_ENABLED !== "true"/);
assert.match(adapter, /getPaystackLiveConfig\(false\)/);
assert.match(adapter, /parsePaystackCreatedPlan\(result, \{ name: body\.name, amountMinor: body\.amount \}, "live"\)/);
assert.doesNotMatch(adapter, /getPaystackTestConfig|PAYSTACK_TEST_SECRET_KEY/);

console.log("PASS Live plan request and exact-domain response validation; provider adapter remains separately gated and has no Test credential fallback");
