import assert from"node:assert/strict";import{readFile}from"node:fs/promises";
async function source(path){return readFile(new URL(`../${path}`,import.meta.url),"utf8")}
const core=await source("app/lib/payments/paystack-core.ts"),webhook=await source("app/api/payments/paystack/webhook/route.ts"),recover=await source("app/api/admin/payments/dispute/recover/route.ts"),provider=await source("app/lib/payments/paystack.ts"),page=await source("app/dashboard/admin/payments/page.tsx");
assert.match(core,/charge\.dispute\.create/);assert.match(core,/charge\.dispute\.remind/);assert.match(core,/charge\.dispute\.resolve/);assert.match(core,/domain !== "test"/);assert.match(core,/transactionReference/);
assert.match(webhook,/verifyPaystackSignature\(rawBody/);assert.match(webhook,/receive_paystack_test_dispute_event/);assert.match(webhook,/process_paystack_test_dispute_event/);
assert.match(recover,/isSameOriginRequest/);assert.match(recover,/getUser\(\)/);assert.match(recover,/is_growvelt_learning_admin/);assert.match(recover,/get_learning_dispute_case_for_recovery/);assert.match(recover,/receive_paystack_test_verified_dispute/);assert.doesNotMatch(recover,/body\?\.provider/);assert.doesNotMatch(recover,/body\?\.resolution/);
assert.match(provider,/api\.paystack\.co\/dispute\/\$\{encodeURIComponent\(input\.disputeId\)\}/);assert.match(provider,/PAYSTACK_MODE/);assert.match(page,/PaymentDisputeSummary/);
console.log("PASS Phase 1B2B app boundaries retain signed webhook, server-only verification, admin origin, and minimal visibility controls");
