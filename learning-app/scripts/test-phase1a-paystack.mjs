import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const signingSecret = "phase1a-unit-signing-secret";

const {
  digestPaystackPayload,
  isTrustedPaystackAuthorizationUrl,
  parsePaystackVerifiedAmounts,
  parsePaystackVerifiedTransaction,
  parsePaystackTestChargeSuccess,
  parsePaystackTestRefundEvent,
  classifyPaystackCheckoutRecovery,
  verifyPaystackSignature,
} = await import("../app/lib/payments/paystack-core.ts");
const { resolvePaystackCallbackReference } = await import("../app/lib/payments/paystack-callback.ts");
const reconciliationRoute = await readFile(new URL("../app/api/payments/paystack/reconcile/route.ts", import.meta.url), "utf8");
const reconciliationMigration = await readFile(new URL("../supabase/migrations/20261020000000_add_learner_verified_payment_reconciliation.sql", import.meta.url), "utf8");
const initializeRoute = await readFile(new URL("../app/api/payments/paystack/initialize/route.ts", import.meta.url), "utf8");

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

assert.deepEqual(parsePaystackVerifiedAmounts({ amount: 4975, requested_amount: 4900, fees: 75 }), {
  amountMinor: 4975,
  requestedAmountMinor: 4900,
  feesMinor: 75,
});
assert.deepEqual(parsePaystackVerifiedAmounts({ amount: 4900 }), {
  amountMinor: 4900,
  requestedAmountMinor: 4900,
  feesMinor: null,
});
assert.equal(parsePaystackVerifiedAmounts({ amount: 4975, requested_amount: 4900, fees: 74 }), null);
assert.equal(parsePaystackVerifiedAmounts({ amount: 4975, requested_amount: 4900 }), null);
assert.equal(parsePaystackVerifiedAmounts({ amount: 4900, requested_amount: 5000, fees: 0 }), null);

const abandonedVerification = parsePaystackVerifiedTransaction({
  id: 123456,
  reference,
  domain: "live",
  status: "abandoned",
  currency: null,
}, reference, "live");
assert.equal(abandonedVerification.ok, true);
assert.equal(abandonedVerification.transaction.status, "abandoned");
assert.equal(abandonedVerification.transaction.amountMinor, null);
assert.equal(parsePaystackVerifiedTransaction({
  id: 123456,
  reference,
  domain: "live",
  status: "failed",
  amount: 100,
  requested_amount: 100,
  currency: "NGN",
}, reference, "live").ok, true);
assert.equal(parsePaystackVerifiedTransaction({
  id: 123456,
  reference,
  domain: "live",
  status: "success",
  amount: 100,
  requested_amount: 120,
  fees: 0,
  currency: "NGN",
}, reference, "live").ok, false);
assert.deepEqual(parsePaystackVerifiedTransaction({
  id: 123456,
  reference: `GL-${"B".repeat(32)}`,
  domain: "live",
  status: "abandoned",
}, reference, "live"), { ok: false, reason: "reference_mismatch" });
assert.deepEqual(parsePaystackVerifiedTransaction({
  id: 123456,
  reference,
  domain: "test",
  status: "abandoned",
}, reference, "live"), { ok: false, reason: "domain_mismatch" });

const recoveryNow = Date.parse("2026-10-27T12:00:00.000Z");
assert.equal(classifyPaystackCheckoutRecovery("success", "2026-10-27T11:59:59.000Z", recoveryNow), "paid");
assert.equal(classifyPaystackCheckoutRecovery("pending", "2026-10-27T10:00:00.000Z", recoveryNow), "pending");
assert.equal(classifyPaystackCheckoutRecovery("failed", "2026-10-27T11:30:01.000Z", recoveryNow), "cooldown");
assert.equal(classifyPaystackCheckoutRecovery("abandoned", "2026-10-27T11:30:00.000Z", recoveryNow), "recoverable");
assert.equal(classifyPaystackCheckoutRecovery("failed", "not-a-date", recoveryNow), "cooldown");

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
const companyReference = `CP-${"C".repeat(32)}`;
assert.equal(resolvePaystackCallbackReference({ reference: [companyReference, companyReference], trxref: companyReference }), companyReference);
assert.equal(resolvePaystackCallbackReference({ reference, trxref: companyReference }), null);
assert.equal(resolvePaystackCallbackReference({ reference, trxref: `GL-${"B".repeat(32)}` }), null);
assert.equal(resolvePaystackCallbackReference({ reference: "invalid-reference" }), null);
assert.equal(resolvePaystackCallbackReference({}), null);

assert.match(reconciliationRoute, /isSameOriginRequest\(request\)/);
assert.match(reconciliationRoute, /supabase\.auth\.getUser\(\)/);
assert.match(reconciliationRoute, /verifyPaystackTransaction\(reference, configuration\.mode\)/);
assert.match(reconciliationRoute, /reconcile_own_paystack_learning_payment/);
assert.match(reconciliationMigration, /o\.learner_id=p_learner_id/);
assert.match(reconciliationMigration, /p_amount_minor - p_requested_amount_minor <> p_fees_minor/);
assert.match(reconciliationMigration, /from public,anon,authenticated/);
assert.match(reconciliationMigration, /to postgres,service_role/);
assert.match(initializeRoute, /verifyPaystackTransaction\(order\.order_reference, domain\)/);
assert.match(initializeRoute, /classifyPaystackCheckoutRecovery\(verified\.status, attempt\.initialized_at\)/);
assert.match(initializeRoute, /fail_paystack_live_learning_attempt/);

console.log("PASS Paystack signature, fee-aware amount validation, learner-owned reconciliation, checkout retry recovery guardrails, and callback normalization tests");
