import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { resolvePaystackConfiguration } = await import("../app/lib/payments/paystack-config.ts");
const liveCallback = "https://learn.growvelt.com/payments/paystack/callback";
const providerSource = await readFile(new URL("../app/lib/payments/paystack.ts", import.meta.url), "utf8");
const coursePageSource = await readFile(new URL("../app/dashboard/courses/[slug]/page.tsx", import.meta.url), "utf8");
const paymentOperationsSource = await readFile(new URL("../app/dashboard/admin/payments/page.tsx", import.meta.url), "utf8");
const initializeRouteSource = await readFile(new URL("../app/api/payments/paystack/initialize/route.ts", import.meta.url), "utf8");
const test = resolvePaystackConfiguration({ PAYSTACK_MODE: "test", PAYSTACK_SECRET_KEY: "sk_test_example", PAYSTACK_CALLBACK_URL: "http://localhost:3000/payments/paystack/callback", PAYMENTS_CHECKOUT_ENABLED: "false", PAYMENTS_REFUNDS_ENABLED: "false" });
assert.equal(test.mode, "test");
assert.equal(test.checkoutEnabled, false);
assert.equal(test.refundsEnabled, false);
assert.equal(test.secretKey, "sk_test_example");
const namedTestKey = resolvePaystackConfiguration({ PAYSTACK_MODE: "test", PAYSTACK_TEST_SECRET_KEY: "sk_test_named_example", PAYSTACK_CALLBACK_URL: liveCallback, PAYMENTS_CHECKOUT_ENABLED: "true", PAYMENTS_REFUNDS_ENABLED: "false" });
assert.equal(namedTestKey.mode, "test");
assert.equal(namedTestKey.checkoutEnabled, true);
assert.equal(namedTestKey.refundsEnabled, false);
const live = resolvePaystackConfiguration({ PAYSTACK_MODE: "live", PAYSTACK_LIVE_SECRET_KEY: "sk_live_example", PAYSTACK_CALLBACK_URL: liveCallback, PAYMENTS_CHECKOUT_ENABLED: "false", PAYMENTS_REFUNDS_ENABLED: "false" });
assert.equal(live.mode, "live");
assert.equal(live.checkoutEnabled, false);
assert.equal(live.liveLearnerCheckoutEnabled, false);
assert.equal(live.refundsEnabled, false);
assert.equal(live.liveRefundsEnabled, false);
const liveGate = resolvePaystackConfiguration({ PAYSTACK_MODE: "live", PAYSTACK_LIVE_SECRET_KEY: "sk_live_example", PAYSTACK_CALLBACK_URL: liveCallback, PAYMENTS_CHECKOUT_ENABLED: "true", PAYMENTS_LIVE_LEARNER_CHECKOUT_ENABLED: "true", PAYMENTS_REFUNDS_ENABLED: "false" });
assert.equal(liveGate.checkoutEnabled, true);
assert.equal(liveGate.liveLearnerCheckoutEnabled, true);
const liveRefundGate = resolvePaystackConfiguration({ PAYSTACK_MODE: "live", PAYSTACK_LIVE_SECRET_KEY: "sk_live_example", PAYSTACK_CALLBACK_URL: liveCallback, PAYMENTS_LIVE_REFUNDS_ENABLED: "true" });
assert.equal(liveRefundGate.liveRefundsEnabled, true);
for (const invalid of [
  {},
  { PAYSTACK_MODE: "sandbox", PAYSTACK_SECRET_KEY: "sk_test_example", PAYSTACK_CALLBACK_URL: liveCallback },
  { PAYSTACK_MODE: "test", PAYSTACK_CALLBACK_URL: liveCallback },
  { PAYSTACK_MODE: "test", PAYSTACK_SECRET_KEY: "sk_test_example", PAYSTACK_TEST_SECRET_KEY: "sk_test_named_example", PAYSTACK_CALLBACK_URL: liveCallback },
  { PAYSTACK_MODE: "live", PAYSTACK_LIVE_SECRET_KEY: "sk_live_example", PAYSTACK_CALLBACK_URL: "https://example.com/payments/paystack/callback" },
  { PAYSTACK_MODE: "live", PAYSTACK_SECRET_KEY: "sk_test_example", PAYSTACK_LIVE_SECRET_KEY: "sk_live_example", PAYSTACK_CALLBACK_URL: liveCallback },
  { PAYSTACK_MODE: "test", PAYSTACK_SECRET_KEY: "sk_test_example", PAYSTACK_LIVE_SECRET_KEY: "sk_live_example", PAYSTACK_CALLBACK_URL: "http://localhost:3000/payments/paystack/callback" },
  { PAYSTACK_MODE: "live", PAYSTACK_LIVE_SECRET_KEY: "sk_live_example", PAYSTACK_CALLBACK_URL: "http://localhost:3000/payments/paystack/callback" },
  { PAYSTACK_MODE: "live", PAYSTACK_LIVE_SECRET_KEY: "sk_test_example", PAYSTACK_CALLBACK_URL: liveCallback },
  { PAYSTACK_MODE: "test", PAYSTACK_SECRET_KEY: "sk_live_example", PAYSTACK_CALLBACK_URL: "http://localhost:3000/payments/paystack/callback" },
]) assert.throws(() => resolvePaystackConfiguration(invalid));
// Test provider operations stay bound to Test credentials. Learner Live
// checkout needs both switches; Live refunds have an independent switch.
assert.match(providerSource, /config\.mode !== "test"/);
assert.match(coursePageSource, /paystackMode === "test" && fixtureEligibility\.eligible/);
assert.match(coursePageSource, /PAYMENTS_LIVE_LEARNER_CHECKOUT_ENABLED === "true"/);
assert.match(initializeRouteSource, /configuration\.mode === "live" && !configuration\.liveLearnerCheckoutEnabled/);
assert.match(initializeRouteSource, /initialize_paystack_live_learning_order/);
assert.match(initializeRouteSource, /initialize_paystack_test_learning_order/);
assert.match(initializeRouteSource, /fail_paystack_live_learning_attempt/);
assert.match(paymentOperationsSource, /PAYMENTS_LIVE_REFUNDS_ENABLED === "true"/);
console.log("PASS Phase 1B3A strict Paystack test/live configuration boundaries, server-only secrets, and independent disabled kill switches");
