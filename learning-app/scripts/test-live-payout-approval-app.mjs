import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [route, operations, migration, sandboxRoute, sandboxOperations] = await Promise.all([
  readFile("app/api/admin/commercial/payout-items/approve/route.ts", "utf8"),
  readFile("app/lib/admin/instructor-payout-transfer.ts", "utf8"),
  readFile("supabase/migrations/20261115000000_add_instructor_live_payout_approval.sql", "utf8"),
  readFile("app/api/admin/commercial/payout-items/submit-test/route.ts", "utf8"),
  readFile("supabase/migrations/20260909000000_add_instructor_payout_test_transfer_foundation.sql", "utf8"),
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
console.log("PASS Live payout approval app and Sandbox isolation boundaries");
