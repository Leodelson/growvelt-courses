import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PaystackRefundFundingError, throwIfRefundFundingRejected } from "../app/lib/payments/refund-initiation-error.ts";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const initiate = await source("app/api/admin/payments/refund/route.ts");
const recover = await source("app/api/admin/payments/refund/recover/route.ts");
const provider = await source("app/lib/payments/paystack.ts");
const configuration = await source("app/lib/payments/paystack-config.ts");
const webhook = await source("app/api/payments/paystack/webhook/route.ts");

for (const message of ["Insufficient balance to process refund", "Insufficient balance to fulfill this refund. Please top up."]) {
  assert.throws(() => throwIfRefundFundingRejected({ status: false, message }), PaystackRefundFundingError);
}
assert.throws(() => throwIfRefundFundingRejected({ status: "false", message: "Insufficient balance to process refund" }), PaystackRefundFundingError);
for (const result of [null, { status: false, message: "Provider request timed out" }, { status: true, message: "Insufficient balance to process refund" }, { status: false, message: "Insufficient balance to process refund", data: { id: 1 } }]) {
  assert.doesNotThrow(() => throwIfRefundFundingRejected(result));
}

for (const route of [initiate, recover]) {
  assert.match(route, /isSameOriginRequest/);
  assert.match(route, /getUser\(\)/);
  assert.match(route, /is_growvelt_learning_admin/);
}

assert.match(initiate, /requirePaystackTestRefundsEnabled/);
assert.match(initiate, /requirePaystackLiveRefundsEnabled/);
assert.match(initiate, /request_paystack_live_full_refund/);
assert.match(initiate, /record_paystack_live_refund_submission/);
assert.match(initiate, /submissionState !== "submitting"/);
assert.match(initiate, /refund_already_submitting/);
assert.ok(initiate.indexOf('submissionState !== "submitting"') < initiate.indexOf("await createPaystackLiveFullRefund"), "A duplicate claim must stop before the live provider call");
assert.ok(initiate.indexOf('submissionState !== "submitting"') < initiate.indexOf("await createPaystackTestFullRefund"), "A duplicate claim must stop before the test provider call");
assert.match(initiate, /verifyPaystackTransaction\(reference, "live"\)/);
assert.match(initiate, /amountMinor: liveCharge\.amountMinor/);
assert.match(provider, /export async function createPaystackLiveFullRefund[\s\S]*?body: JSON\.stringify\(\{ transaction: input\.transactionId, amount: input\.amountMinor, merchant_note:/);
assert.match(initiate, /confirmation !== reference/);
assert.match(initiate, /request_paystack_test_full_refund/);
assert.doesNotMatch(initiate, /amount_minor\s*:\s*body/);
assert.match(initiate, /p_provider_status: "needs-attention"/);
assert.match(initiate, /error instanceof PaystackRefundFundingError/);
assert.match(initiate, /greeting: context\.firstName \?\? "there"/);
assert.match(initiate, /heading: ""/);
assert.match(initiate, /p_provider_status: "failed"/);
assert.match(initiate, /recordedStatus !== "failed"/);
assert.match(initiate, /refund_funding_unavailable/);
assert.match(recover, /get_learning_test_refund_case_for_recovery/);
assert.match(recover, /get_learning_live_refund_case_for_recovery/);
assert.match(recover, /findPaystackRefundIdForTransaction/);
assert.match(recover, /expectedRefundMinor = charge\.amountMinor/);
assert.match(recover, /close_unsubmitted_paystack_live_refund_case/);
assert.ok(recover.indexOf("if (!refundId)") < recover.indexOf("close_unsubmitted_paystack_live_refund_case"), "Only a complete empty provider lookup may close a stuck case");
assert.match(recover, /\["needs_attention", "submitting"\]\.includes\(refundCase\.status\)/);
assert.match(recover, /Date\.now\(\) - updatedAt < 15 \* 60_000/);
assert.match(recover, /refundCase\.provider_case_id !== null/);
assert.match(recover, /refund_not_found/);
assert.match(recover, /verifyPaystackLiveRefund/);
assert.match(recover, /recover_paystack_live_refund_event/);
assert.match(recover, /greeting:context\.firstName\?\?"there"/);
assert.doesNotMatch(recover, /requirePaystackTestRefundsEnabled/);
assert.doesNotMatch(recover, /body\?\.providerCaseId/);
assert.doesNotMatch(recover, /body\?\.reference/);
assert.match(provider, /resolvePaystackConfiguration/);
assert.equal((provider.match(/throwIfRefundFundingRejected\(result\);/g) ?? []).length, 2);
assert.match(configuration, /PAYMENTS_REFUNDS_ENABLED === "true"/);
const refundInitiation = provider.slice(provider.indexOf("export async function createPaystackTestFullRefund"), provider.indexOf("export async function verifyPaystackTestRefund"));
assert.match(refundInitiation, /body: JSON\.stringify\(\{ transaction: input\.transactionId, merchant_note:/);
assert.doesNotMatch(refundInitiation, /amount:/);
assert.match(provider, /api\.paystack\.co\/refund\/\$\{encodeURIComponent\(input\.refundId\)\}/);
assert.match(provider, /export async function findPaystackRefundIdForTransaction/);
assert.match(provider, /url\.searchParams\.set\("transaction", input\.transactionId\)/);
assert.match(provider, /candidates\.length > 1/);
assert.doesNotMatch(provider.slice(provider.indexOf("export async function findPaystackRefundIdForTransaction"), provider.indexOf("export type PaystackDispute")), /method:\s*"POST"/);
assert.match(webhook, /verifyPaystackSignature\(rawBody/);
assert.match(webhook, /receive_paystack_test_refund_event/);
assert.match(webhook, /process_paystack_test_refund_event/);
assert.match(webhook, /receive_paystack_live_refund_event/);
assert.match(webhook, /process_paystack_live_refund_event/);

console.log("PASS Phase 1B2A refund routes retain flag, origin, admin, amount, and signed-webhook boundaries");
