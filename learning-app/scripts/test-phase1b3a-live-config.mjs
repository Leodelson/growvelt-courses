import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { resolvePaystackConfiguration } = await import("../app/lib/payments/paystack-config.ts");
const liveCallback = "https://learn.growvelt.com/payments/paystack/callback";
const providerSource = await readFile(new URL("../app/lib/payments/paystack.ts", import.meta.url), "utf8");
const coursePageSource = await readFile(new URL("../app/dashboard/courses/[slug]/page.tsx", import.meta.url), "utf8");
const paymentOperationsSource = await readFile(new URL("../app/dashboard/admin/payments/page.tsx", import.meta.url), "utf8");
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
assert.equal(live.refundsEnabled, false);
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
// Provider operations and UI exposure remain test-only until a separately
// approved live-domain migration exists. Changing mode alone cannot enable them.
assert.match(providerSource, /config\.mode !== "test"/);
assert.match(coursePageSource, /process\.env\.PAYSTACK_MODE === "test"/);
assert.match(paymentOperationsSource, /process\.env\.PAYSTACK_MODE === "test"/);
console.log("PASS Phase 1B3A strict Paystack test/live configuration boundaries, server-only secrets, and independent disabled kill switches");
