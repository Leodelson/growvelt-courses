import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  parsePaystackLiveSubscriptionRefund,
  parsePaystackLiveSubscriptionRefundListMatch,
  parsePaystackLiveSubscriptionTransaction,
} from "../app/lib/payments/paystack-subscription-refund-core.ts";

const reference = "GS-Subscription_1234567890";
const merchantNote = "Growvelt subscription refund case 42";
const transaction = {
  status: true,
  data: {
    id: 90008,
    reference,
    amount: 5000,
    requested_amount: 5000,
    fees: 0,
    currency: "NGN",
    domain: "live",
    status: "success",
  },
};
assert.deepEqual(parsePaystackLiveSubscriptionTransaction(transaction, reference), {
  reference,
  transactionId: "90008",
  amountMinor: 5000,
  requestedAmountMinor: 5000,
  currency: "NGN",
  domain: "live",
  status: "success",
});
for (const invalid of [
  { ...transaction, data: { ...transaction.data, reference: "other" } },
  { ...transaction, data: { ...transaction.data, domain: "test" } },
  { ...transaction, data: { ...transaction.data, currency: "USD" } },
  { ...transaction, data: { ...transaction.data, amount: 4999 } },
  { ...transaction, data: { ...transaction.data, requested_amount: 4999, fees: 0 } },
  { ...transaction, data: { ...transaction.data, amount: 5001, requested_amount: 4999, fees: 1 } },
  { ...transaction, data: { ...transaction.data, id: Number.MAX_SAFE_INTEGER + 1 } },
]) assert.equal(parsePaystackLiveSubscriptionTransaction(invalid, reference), null);
assert.equal(parsePaystackLiveSubscriptionTransaction(transaction, "bad/reference"), null);

const refundData = {
  id: 123456,
  transaction: { id: 90008, reference },
  amount: 5000,
  currency: "NGN",
  domain: "live",
  status: "pending",
  createdAt: "2026-11-02T10:00:00.000Z",
  merchant_note: merchantNote,
};
assert.deepEqual(parsePaystackLiveSubscriptionRefund({ status: true, data: refundData }, {
  transactionId: "90008", amountMinor: 5000, merchantNote,
}), {
  id: "123456",
  transactionId: "90008",
  amountMinor: 5000,
  currency: "NGN",
  domain: "live",
  status: "pending",
  createdAt: "2026-11-02T10:00:00.000Z",
  refundReference: null,
  merchantNote,
  payload: refundData,
});
for (const invalid of [
  { ...refundData, transaction: { id: 90009 } },
  { ...refundData, amount: 4999 },
  { ...refundData, domain: "test" },
  { ...refundData, currency: "USD" },
  { ...refundData, status: "reversed" },
  { ...refundData, merchant_note: "manual refund" },
  { ...refundData, id: Number.MAX_SAFE_INTEGER + 1 },
]) assert.equal(parsePaystackLiveSubscriptionRefund({ status: true, data: invalid }, {
  transactionId: "90008", amountMinor: 5000, merchantNote,
}), null);

const requestedAt = "2026-11-02T09:59:30.000Z";
const refundList = { status: true, meta: { pageCount: 1 }, data: [refundData] };
assert.equal(parsePaystackLiveSubscriptionRefundListMatch(refundList, {
  transactionId: "90008", amountMinor: 5000, requestedAt, merchantNote,
  now: Date.parse("2026-11-02T10:01:00.000Z"),
}), "123456");
assert.equal(parsePaystackLiveSubscriptionRefundListMatch({ status: true, meta: { pageCount: 0 }, data: [] }, {
  transactionId: "90008", amountMinor: 5000, requestedAt, merchantNote,
}), null);
assert.throws(() => parsePaystackLiveSubscriptionRefundListMatch({
  status: true, meta: { pageCount: 1 }, data: [{ ...refundData, createdAt: "2026-11-02T09:00:00.000Z" }],
}, { transactionId: "90008", amountMinor: 5000, requestedAt, merchantNote }));
assert.throws(() => parsePaystackLiveSubscriptionRefundListMatch({
  status: true, meta: { pageCount: 2 }, data: [refundData],
}, { transactionId: "90008", amountMinor: 5000, requestedAt, merchantNote }));
assert.throws(() => parsePaystackLiveSubscriptionRefundListMatch({
  status: true, meta: { pageCount: 1 }, data: [refundData, refundData],
}, { transactionId: "90008", amountMinor: 5000, requestedAt, merchantNote }));

const adapter = await readFile(new URL("../app/lib/payments/paystack-live-subscription-refunds.ts", import.meta.url), "utf8");
const initiateRoute = await readFile(new URL("../app/api/admin/payments/subscription-refund/route.ts", import.meta.url), "utf8");
const recoverRoute = await readFile(new URL("../app/api/admin/payments/subscription-refund/recover/route.ts", import.meta.url), "utf8");
const refundControl = await readFile(new URL("../app/components/admin/subscription-refund-control.tsx", import.meta.url), "utf8");
assert.match(adapter, /GROWVELT_LEARNING_LIVE_SUBSCRIPTION_REFUNDS_ENABLED !== "true"/);
assert.match(adapter, /config\.liveRefundsEnabled/);
assert.match(adapter, /transaction\/verify/);
assert.match(adapter, /method: "POST"/);
assert.match(adapter, /await assertNoPriorPaystackLiveSubscriptionRefund\(input\.transactionId\)/);
assert.match(adapter, /searchParams\.set\("transaction", transactionId\)/);
assert.match(adapter, /refund\/\$\{encodeURIComponent\(input\.refundId\)\}/);
assert.match(adapter, /merchant_note: merchantNote/);
assert.match(adapter, /merchantNote,\s*\}\);/);
assert.match(initiateRoute, /PAYMENTS_LIVE_REFUNDS_ENABLED !== "true"/);
assert.match(initiateRoute, /GROWVELT_LEARNING_LIVE_SUBSCRIPTION_REFUNDS_ENABLED !== "true"/);
assert.match(initiateRoute, /confirmation !== invoiceReference/);
assert.match(initiateRoute, /caseId: refundCase\.case_id/);
assert.ok(initiateRoute.indexOf('if (submissionState !== "submitting")') < initiateRoute.indexOf("providerRefund = await createPaystackLiveSubscriptionFullRefund"),
  "The database claim must be acquired before a provider refund POST");
assert.match(recoverRoute, /findPaystackLiveSubscriptionRefund/);
assert.doesNotMatch(recoverRoute, /createPaystackLiveSubscriptionFullRefund/,
  "Refund recovery must remain read-only and never POST a second refund");
assert.match(recoverRoute, /15 \* 60_000/);
assert.match(refundControl, /confirmation !== invoiceReference/);
assert.match(refundControl, /The provider confirmed a failed refund/);

console.log("PASS Live subscription provider adapters require exact charge/refund identity, reject truncated/ambiguous history, and remain behind independent Live refund gates");
