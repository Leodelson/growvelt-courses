import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const initiate = await source("app/api/admin/payments/refund/route.ts");
const recover = await source("app/api/admin/payments/refund/recover/route.ts");
const provider = await source("app/lib/payments/paystack.ts");
const webhook = await source("app/api/payments/paystack/webhook/route.ts");

for (const route of [initiate, recover]) {
  assert.match(route, /isSameOriginRequest/);
  assert.match(route, /getUser\(\)/);
  assert.match(route, /is_growvelt_learning_admin/);
  assert.match(route, /requirePaystackTestRefundsEnabled/);
}

assert.match(initiate, /confirmation !== reference/);
assert.match(initiate, /request_paystack_test_full_refund/);
assert.doesNotMatch(initiate, /amount_minor\s*:\s*body/);
assert.match(initiate, /p_provider_status: "needs-attention"/);
assert.doesNotMatch(initiate, /p_provider_status: "failed"/);
assert.match(recover, /get_learning_refund_case_for_recovery/);
assert.doesNotMatch(recover, /body\?\.providerCaseId/);
assert.doesNotMatch(recover, /body\?\.reference/);
assert.match(provider, /PAYMENTS_REFUNDS_ENABLED === "true"/);
const refundInitiation = provider.slice(provider.indexOf("export async function createPaystackTestFullRefund"), provider.indexOf("export async function verifyPaystackTestRefund"));
assert.match(refundInitiation, /body: JSON\.stringify\(\{ transaction: input\.transactionId, merchant_note:/);
assert.doesNotMatch(refundInitiation, /amount:/);
assert.match(provider, /api\.paystack\.co\/refund\/\$\{encodeURIComponent\(input\.refundId\)\}/);
assert.match(webhook, /verifyPaystackSignature\(rawBody/);
assert.match(webhook, /receive_paystack_test_refund_event/);
assert.match(webhook, /process_paystack_test_refund_event/);

console.log("PASS Phase 1B2A refund routes retain flag, origin, admin, amount, and signed-webhook boundaries");
