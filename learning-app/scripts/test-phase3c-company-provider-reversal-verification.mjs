import assert from "node:assert/strict";
import { parseVerifiedPaystackCompanyDispute, parseVerifiedPaystackCompanyRefund } from "../app/lib/payments/paystack-core.ts";

const transactionReference = `CP-${"A".repeat(32)}`;
const base = { transactionId: "42001", transactionReference, domain: "test" };
const refundExpected = { ...base, refundId: "91" };
const refund = { id: 91, transaction: 42001, domain: "test", currency: "NGN", amount: 10000, status: "processed" };
assert.equal(parseVerifiedPaystackCompanyRefund(refund, refundExpected)?.finalOutcome, "processed_refund");
assert.equal(parseVerifiedPaystackCompanyRefund({ ...refund, status: "pending" }, refundExpected)?.finalOutcome, null);
assert.equal(parseVerifiedPaystackCompanyRefund({ ...refund, status: "processing" }, refundExpected)?.finalOutcome, null);
assert.equal(parseVerifiedPaystackCompanyRefund({ ...refund, id: 92 }, refundExpected), null);
assert.equal(parseVerifiedPaystackCompanyRefund({ ...refund, transaction: 42002 }, refundExpected), null);
assert.equal(parseVerifiedPaystackCompanyRefund({ ...refund, domain: "live" }, refundExpected), null);
assert.equal(parseVerifiedPaystackCompanyRefund({ ...refund, transaction_reference: `CP-${"B".repeat(32)}` }, refundExpected), null);
assert.equal(parseVerifiedPaystackCompanyRefund({ ...refund, amount: 0 }, refundExpected), null);
assert.equal(parseVerifiedPaystackCompanyRefund({ ...refund, currency: "USD" }, refundExpected), null);

const disputeExpected = { ...base, disputeId: "92" };
const dispute = { id: 92, domain: "test", currency: null, status: "resolved", resolution: "merchant-accepted",
  refund_amount: null, transaction: { id: 42001, domain: "test", currency: "NGN", reference: transactionReference, amount: 20000 } };
assert.equal(parseVerifiedPaystackCompanyDispute(dispute, disputeExpected)?.finalOutcome, "lost_dispute");
assert.equal(parseVerifiedPaystackCompanyDispute({ ...dispute, status: "pending" }, disputeExpected)?.finalOutcome, null);
assert.equal(parseVerifiedPaystackCompanyDispute({ ...dispute, resolution: "declined" }, disputeExpected)?.finalOutcome, null);
assert.equal(parseVerifiedPaystackCompanyDispute({ ...dispute, transaction: { ...dispute.transaction, id: 42002 } }, disputeExpected), null);
assert.equal(parseVerifiedPaystackCompanyDispute({ ...dispute, transaction: { ...dispute.transaction, reference: "wrong" } }, disputeExpected), null);
assert.equal(parseVerifiedPaystackCompanyDispute({ ...dispute, domain: "live" }, disputeExpected), null);
assert.equal(parseVerifiedPaystackCompanyDispute({ ...dispute, currency: "USD" }, disputeExpected), null);
assert.equal(parseVerifiedPaystackCompanyDispute({ ...dispute, refund_amount: 0 }, disputeExpected), null);
console.log("PASS company provider reversal verification rejects pending and mismatched refund/dispute records");
