import { createHmac } from "node:crypto";
import assert from "node:assert/strict";

const signingSecret = "phase1a-unit-signing-secret";

const {
  digestPaystackPayload,
  isTrustedPaystackAuthorizationUrl,
  parsePaystackTestChargeSuccess,
  verifyPaystackSignature,
} = await import("../app/lib/payments/paystack-core.ts");

const reference = `GL-${"A".repeat(32)}`;
const event = {
  event: "charge.success",
  data: {
    id: 123456,
    reference,
    amount: 250000,
    currency: "NGN",
    domain: "test",
    status: "success",
    channel: "card",
    paid_at: "2026-08-23T12:00:00.000Z",
  },
};
const rawBody = JSON.stringify(event);
const signature = createHmac("sha512", signingSecret).update(rawBody).digest("hex");

assert.equal(verifyPaystackSignature(rawBody, signature, signingSecret), true);
assert.equal(verifyPaystackSignature(`${rawBody} `, signature, signingSecret), false);
assert.match(digestPaystackPayload(rawBody), /^[a-f0-9]{64}$/);
assert.equal(isTrustedPaystackAuthorizationUrl("https://checkout.paystack.com/example"), true);
assert.equal(isTrustedPaystackAuthorizationUrl("https://checkout.paystack.com.evil.invalid/example"), false);

const parsed = parsePaystackTestChargeSuccess(event);
assert.equal(parsed?.reference, reference);
assert.equal(parsed?.amountMinor, 250000);
assert.equal(parsePaystackTestChargeSuccess({ ...event, data: { ...event.data, domain: "live" } }), null);
assert.equal(parsePaystackTestChargeSuccess({ ...event, data: { ...event.data, currency: "USD" } }), null);
assert.equal(parsePaystackTestChargeSuccess({ ...event, data: { ...event.data, status: "failed" } }), null);
assert.equal(parsePaystackTestChargeSuccess({ ...event, data: { ...event.data, reference: "client-reference" } }), null);

console.log("PASS Phase 1A Paystack signature, event parsing, and trusted-URL tests");
