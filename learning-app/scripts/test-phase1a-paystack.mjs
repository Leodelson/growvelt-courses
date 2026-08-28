import { createHmac } from "node:crypto";
import assert from "node:assert/strict";

const signingSecret = "phase1a-unit-signing-secret";

const {
  digestPaystackPayload,
  isTrustedPaystackAuthorizationUrl,
  parsePaystackTestChargeSuccess,
  parsePaystackTestRefundEvent,
  verifyPaystackSignature,
} = await import("../app/lib/payments/paystack-core.ts");
const { resolvePaystackCallbackReference } = await import("../app/lib/payments/paystack-callback.ts");

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

const refundEvent = { event: "refund.processed", data: { id: 740001, transaction_reference: reference, refund_reference: "refund-740001", amount: "250000", currency: "NGN", domain: "test", status: "processed" } };
const parsedRefund = parsePaystackTestRefundEvent(refundEvent);
assert.equal(parsedRefund?.transactionReference, reference);
assert.equal(parsedRefund?.refundId, "740001");
assert.equal(parsedRefund?.amountMinor, 250000);
assert.equal(parsedRefund?.status, "processed");
const documentedPendingRefund = parsePaystackTestRefundEvent({ event: "refund.pending", data: { transaction_reference: reference, refund_reference: null, amount: "250000", currency: "NGN", domain: "test", status: "pending" } });
assert.equal(documentedPendingRefund?.refundId, null);
assert.equal(documentedPendingRefund?.eventId, `refund.pending:${reference}:250000`);
assert.equal(parsePaystackTestRefundEvent({ ...refundEvent, data: { ...refundEvent.data, domain: "live" } }), null);
assert.equal(parsePaystackTestRefundEvent({ ...refundEvent, data: { ...refundEvent.data, amount: "0" } }), null);
assert.equal(parsePaystackTestRefundEvent({ ...refundEvent, event: "refund.unknown" }), null);

assert.equal(resolvePaystackCallbackReference({ reference }), reference);
assert.equal(resolvePaystackCallbackReference({ reference: [reference, reference] }), reference);
assert.equal(resolvePaystackCallbackReference({ trxref: reference }), reference);
assert.equal(resolvePaystackCallbackReference({ reference: [reference, reference], trxref: reference }), reference);
assert.equal(resolvePaystackCallbackReference({ reference, trxref: `GL-${"B".repeat(32)}` }), null);
assert.equal(resolvePaystackCallbackReference({ reference: "invalid-reference" }), null);
assert.equal(resolvePaystackCallbackReference({}), null);

console.log("PASS Phase 1A Paystack signature, event parsing, callback normalization, and trusted-URL tests");
