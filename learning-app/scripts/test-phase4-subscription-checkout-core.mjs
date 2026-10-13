import assert from "node:assert/strict";
import {
  buildPaystackTestSubscriptionCheckoutRequest,
  parsePaystackTestSubscriptionCheckoutResponse,
  parsePaystackTestSubscriptionWebhook,
} from "../app/lib/payments/paystack-subscription-core.ts";

const subscriptionId = "20000000-0000-4000-8000-000000000001";
const invoiceId = "30000000-0000-4000-8000-000000000001";
const reference = `GS-${"A".repeat(32)}`;
const checkout = buildPaystackTestSubscriptionCheckoutRequest({
  email: " learner@example.com ",
  amountMinor: 149900,
  reference,
  planCode: "PLN_gx2wn530m0i3w3m",
  callbackUrl: "https://learn.growvelt.com/payments/paystack/callback",
  subscriptionId,
  invoiceId,
});

assert.deepEqual(checkout, {
  email: "learner@example.com",
  amount: "149900",
  currency: "NGN",
  reference,
  plan: "PLN_gx2wn530m0i3w3m",
  callback_url: "https://learn.growvelt.com/payments/paystack/callback",
  metadata: {
    product: "growvelt_learning_subscription",
    environment: "test",
    subscription_id: subscriptionId,
    invoice_id: invoiceId,
  },
});

for (const patch of [
  { amountMinor: 0 },
  { amountMinor: Number.MAX_SAFE_INTEGER + 1 },
  { reference: "GL-" + "A".repeat(32) },
  { planCode: "PLN_not-a-provider-code" },
  { callbackUrl: "javascript:alert(1)" },
  { callbackUrl: "http://learn.growvelt.com/payments/callback" },
  { email: "not-an-email" },
  { subscriptionId: "not-a-uuid" },
]) {
  assert.throws(() => buildPaystackTestSubscriptionCheckoutRequest({
    email: "learner@example.com",
    amountMinor: 149900,
    reference,
    planCode: "PLN_gx2wn530m0i3w3m",
    callbackUrl: "https://learn.growvelt.com/payments/paystack/callback",
    subscriptionId,
    invoiceId,
    ...patch,
  }));
}

assert.deepEqual(parsePaystackTestSubscriptionCheckoutResponse({
  status: true,
  data: {
    authorization_url: "https://checkout.paystack.com/secure-session",
    access_code: "secure_code_123",
    reference,
  },
}, reference), {
  authorizationUrl: "https://checkout.paystack.com/secure-session",
  accessCode: "secure_code_123",
  reference,
});
assert.equal(parsePaystackTestSubscriptionCheckoutResponse({
  status: true,
  data: { authorization_url: "https://attacker.example/pay", access_code: "secure_code_123", reference },
}, reference), null);
assert.equal(parsePaystackTestSubscriptionCheckoutResponse({
  status: true,
  data: { authorization_url: "https://checkout.paystack.com/pay", access_code: "secure_code_123", reference: "GS-" + "B".repeat(32) },
}, reference), null);

const initialChargePayload = {
  event: "charge.success",
  data: {
    domain: "test", reference, id: 90123, status: "success", amount: 149900, currency: "NGN",
    subscription: { subscription_code: "SUB_1234567890" },
  },
};
const initialCharge = parsePaystackTestSubscriptionWebhook(initialChargePayload);
assert.deepEqual(initialCharge, {
  kind: "initial_charge_success",
  eventId: "charge.success:transaction:90123",
  reference,
  transactionId: "90123",
  amountMinor: 149900,
  currency: "NGN",
  paymentDomain: "test",
  subscriptionCode: "SUB_1234567890",
});
assert.deepEqual(parsePaystackTestSubscriptionWebhook(initialChargePayload), initialCharge,
  "replayed charge events must normalize to the same idempotency key");

const renewalCharge = parsePaystackTestSubscriptionWebhook({
  event: "charge.success",
  data: {
    domain: "test", reference: "provider-renewal-reference", id: "90124", status: "success",
    amount: "149900", currency: "NGN", subscription: { subscription_code: "SUB_1234567890" },
  },
});
assert.equal(renewalCharge?.kind, "renewal_charge_success");
assert.equal(renewalCharge?.eventId, "charge.success:transaction:90124");
assert.equal(parsePaystackTestSubscriptionWebhook({
  ...initialChargePayload,
  data: { ...initialChargePayload.data, domain: "live" },
}), null, "a Live-domain event must not enter the Test Mode processor");
assert.equal(parsePaystackTestSubscriptionWebhook({
  event: "charge.success",
  data: { ...initialChargePayload.data, status: "failed" },
}), null, "a non-success transaction must not normalize as a successful charge");
assert.equal(parsePaystackTestSubscriptionWebhook({
  event: "charge.success",
  data: { ...initialChargePayload.data, reference: "unrelated-reference", subscription: undefined },
}), null, "unrelated one-time purchase events must be left to their existing processor");

const invoiceCreated = parsePaystackTestSubscriptionWebhook({
  event: "invoice.create",
  data: {
    domain: "test", invoice_code: "INV_1234567890", amount: 149900, status: "success", currency: "NGN",
    period_start: "2026-10-12T00:00:00.000Z", period_end: "2026-11-12T00:00:00.000Z",
    subscription: { subscription_code: "SUB_1234567890" },
  },
});
assert.deepEqual(invoiceCreated, {
  kind: "invoice_create",
  eventId: "invoice.create:invoice:INV_1234567890:status:success",
  invoiceCode: "INV_1234567890",
  subscriptionCode: "SUB_1234567890",
  amountMinor: 149900,
  currency: "NGN",
  paymentDomain: "test",
  status: "success",
  periodStartsAt: "2026-10-12T00:00:00.000Z",
  paidThrough: "2026-11-12T00:00:00.000Z",
  transactionReference: null,
});

const failedInvoice = parsePaystackTestSubscriptionWebhook({
  event: "invoice.payment_failed",
  data: {
    domain: "test", invoice_code: "INV_1234567890", amount: 149900, status: "attention", currency: "NGN",
    subscription: { subscription_code: "SUB_1234567890" },
  },
});
assert.equal(failedInvoice?.kind, "invoice_payment_failed");
assert.equal(failedInvoice?.eventId, "invoice.payment_failed:invoice:INV_1234567890:status:attention");

const notRenewing = parsePaystackTestSubscriptionWebhook({
  event: "subscription.not_renew",
  data: { domain: "test", subscription_code: "SUB_1234567890", status: "non-renewing" },
});
assert.deepEqual(notRenewing, {
  kind: "subscription_not_renew",
  eventId: "subscription.not_renew:subscription:SUB_1234567890:status:non-renewing",
  subscriptionCode: "SUB_1234567890",
  paymentDomain: "test",
  status: "non-renewing",
  planCode: null,
  customerCode: null,
  customerEmail: null,
});

const subscriptionCreated = parsePaystackTestSubscriptionWebhook({
  event: "subscription.create",
  data: {
    domain: "test",
    subscription: { subscription_code: "SUB_1234567890", plan: { plan_code: "PLN_gx2wn530m0i3w3m" } },
    customer: { customer_code: "CUS_12345678", email: "Learner@example.com" },
  },
});
assert.equal(subscriptionCreated?.kind, "subscription_create");
assert.equal(subscriptionCreated?.planCode, "PLN_gx2wn530m0i3w3m");
assert.equal(subscriptionCreated?.customerEmail, "learner@example.com");

assert.equal(parsePaystackTestSubscriptionWebhook({ event: "subscription.expiring_cards", data: [] }), null,
  "unimplemented provider events must be acknowledged without changing subscription state");

console.log("Phase 4 isolated subscription checkout and webhook contract tests passed.");
