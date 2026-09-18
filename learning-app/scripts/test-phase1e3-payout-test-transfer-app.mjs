import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile("supabase/migrations/20260909000000_add_instructor_payout_test_transfer_foundation.sql", "utf8");
const paystack = await readFile("app/lib/payments/paystack.ts", "utf8");
const webhook = await readFile("app/api/payments/paystack/webhook/route.ts", "utf8");
const approvalRoute = await readFile("app/api/admin/commercial/payout-items/approve/route.ts", "utf8");
const submissionRoute = await readFile("app/api/admin/commercial/payout-items/submit-test/route.ts", "utf8");
const recoveryRoute = await readFile("app/api/admin/commercial/payout-items/recover-test/route.ts", "utf8");
const transferOperations = await readFile("app/lib/admin/instructor-payout-transfer.ts", "utf8");

assert.match(migration, /create table public\.learning_instructor_payout_items/);
assert.match(migration, /reservation_id bigint not null unique/);
assert.match(migration, /provider_domain text not null default 'test' check \(provider_domain='test'\)/);
assert.match(migration, /future_payout_item_reference='lpi-reservation-'/);
assert.match(migration, /lock table public\.learning_payment_cases in share row exclusive mode/);
assert.match(migration, /status='reserved'/);
assert.match(migration, /revoke all on public\.learning_instructor_payout_items,public\.learning_instructor_payout_item_events from public,anon,authenticated/);
assert.match(migration, /begin_learning_instructor_test_transfer/);
assert.match(migration, /recovery_required/);
assert.match(migration, /mark_learning_instructor_test_transfer_recovery_required/);
assert.match(migration, /get_learning_instructor_test_transfer_for_recovery/);
assert.match(migration, /record_learning_instructor_test_transfer_verification/);
assert.match(migration, /item\.status in \('submitting','pending','recovery_required'\)/);
assert.match(migration, /old\.status='submitting' and new\.status in \('pending','recovery_required','succeeded','failed','reversed','cancelled','financially_blocked'\)/);
assert.match(migration, /item\.status='financially_blocked'/);
assert.match(migration, /provider_transfer_id is not null/);
assert.match(migration, /block_learning_payout_item_after_earning_reversal/);
assert.doesNotMatch(migration, /payout.*ledger.*transaction/i);
assert.match(paystack, /export async function initiatePaystackTestTransfer/);
assert.match(paystack, /export async function verifyPaystackTestTransfer/);
assert.match(paystack, /getPaystackTestConfig\(false\)/);
assert.match(paystack, /data\?\.domain !== "test"/);
assert.doesNotMatch(paystack, /initiatePaystackLiveTransfer/);
assert.match(webhook, /parsePaystackTestTransferEvent/);
assert.match(webhook, /receive_paystack_test_transfer_event/);
for (const route of [approvalRoute, submissionRoute, recoveryRoute]) {
  assert.match(route, /isSameOriginRequest/);
  assert.match(route, /is_growvelt_learning_admin/);
  assert.doesNotMatch(route, /amountMinor|recipientCode|instructorId|secretKey/);
}
assert.match(transferOperations, /mark_learning_instructor_test_transfer_recovery_required/);
assert.match(transferOperations, /verifyPaystackTestTransfer\(item\.payout_item_reference\)/);
assert.doesNotMatch(transferOperations, /fail_learning_instructor_test_transfer_submission/);
console.log("Phase 1E3 Test payout transfer application boundary checks passed.");
