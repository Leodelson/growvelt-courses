import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [route, operations, migration, sandboxRoute, sandboxOperations, liveReceipts, webhook, adminPage] = await Promise.all([
  readFile("app/api/admin/commercial/payout-items/approve/route.ts", "utf8"),
  readFile("app/lib/admin/instructor-payout-transfer.ts", "utf8"),
  readFile("supabase/migrations/20261115000000_add_instructor_live_payout_approval.sql", "utf8"),
  readFile("app/api/admin/commercial/payout-items/submit-test/route.ts", "utf8"),
  readFile("supabase/migrations/20260909000000_add_instructor_payout_test_transfer_foundation.sql", "utf8"),
  readFile("supabase/migrations/20261116000000_add_instructor_live_payout_event_receipts.sql", "utf8"),
  readFile("app/api/payments/paystack/webhook/route.ts", "utf8"),
  readFile("app/dashboard/admin/commercial/page.tsx", "utf8"),
]);
assert.match(route, /isSameOriginRequest\(request\)/);
assert.match(route, /is_growvelt_learning_admin/);
assert.match(route, /LEARNING_LIVE_PAYOUT_APPROVAL_ENABLED !== "true"/);
assert.match(route, /approveInstructorLivePayout/);
assert.match(operations, /approve_learning_instructor_live_payout_item/);
assert.doesNotMatch(operations, /initiatePaystackLiveTransfer/);
assert.match(migration, /attempt\.paystack_domain='live'/);
assert.match(migration, /succeeded_count<>1 or live_matching_count<>1/);
assert.match(migration, /profile\.provider_domain='live'/);
assert.match(migration, /lock table public\.learning_payment_cases in share row exclusive mode/);
assert.match(migration, /item\.provider_domain<>''test'' or item\.status<>''approved''/);
assert.match(migration, /revoke all on function public\.approve_learning_instructor_live_payout_item/);
assert.doesNotMatch(migration, /begin_learning_instructor_live_transfer|initiatePaystackLiveTransfer/);
assert.match(sandboxRoute, /submitInstructorTestPayout/);
assert.match(sandboxOperations, /begin_learning_instructor_test_transfer/);
assert.match(liveReceipts, /receive_paystack_live_transfer_provider_event/);
assert.match(liveReceipts, /item\.provider_domain<>ev\.provider_domain/);
assert.match(liveReceipts, /'live:'\|\|p_provider_event_id/);
assert.doesNotMatch(liveReceipts, /initiatePaystackLiveTransfer/);
assert.match(webhook, /LEARNING_LIVE_PAYOUT_RECONCILIATION_ENABLED === "true"/);
assert.match(webhook, /verifyPaystackSignature/);
assert.match(webhook, /receive_paystack_live_transfer_provider_event/);
assert.match(adminPage, /item\.provider_domain === "test" \? <CommercialPayoutTransferControl/);
console.log("PASS Live payout approval and reconciliation app isolation boundaries");
