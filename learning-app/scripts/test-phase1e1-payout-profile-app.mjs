import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(root, file), "utf8");
const [route, paystack, migration, instructorPage, adminPage, navigation] = await Promise.all([
  read("app/api/instructor/payout-profile/route.ts"),
  read("app/lib/payments/paystack.ts"),
  read("supabase/migrations/20260907000000_add_instructor_payout_profile_recipient_foundation.sql"),
  read("app/dashboard/instructor/payout-profile/page.tsx"),
  read("app/dashboard/admin/commercial/page.tsx"),
  read("app/components/learning-shell-navigation.tsx"),
]);

assert.match(route, /isSameOriginRequest\(request\)/);
assert.match(route, /is_approved_growvelt_instructor/);
assert.match(route, /createAdminClient\(\)\.rpc\("create_learning_instructor_paystack_test_payout_profile"/);
assert.doesNotMatch(route, /PAYSTACK_SECRET|sk_test_|sk_live_/);
assert.doesNotMatch(route, /console\.(log|error).*accountNumber/);
assert.match(paystack, /getPaystackTestConfig/);
assert.match(paystack, /data\?\.domain !== "test"/);
assert.match(paystack, /account_number: input\.accountNumber/);
assert.match(paystack, /accountLast4: input\.accountNumber\.slice\(-4\)/);
assert.doesNotMatch(paystack, /getPaystackLiveConfig.*TransferRecipient/);
assert.match(migration, /provider_domain text not null check \(provider_domain in \('test','live'\)\)/);
assert.match(migration, /create_learning_instructor_paystack_test_payout_profile/);
assert.match(migration, /provider_domain='test'/);
assert.match(migration, /for update/);
assert.match(migration, /grant execute on function public\.get_own_learning_instructor_payout_profiles\(\) to authenticated/);
assert.doesNotMatch(migration, /grant execute on function public\.create_learning_instructor_paystack_test_payout_profile\([^\n]+\) to authenticated/);
assert.match(migration, /account_last4/);
assert.doesNotMatch(migration, /account_number text|account_number varchar/);
assert.match(instructorPage, /Test-mode recipient/);
assert.match(instructorPage, /does not reserve earnings, start a transfer/);
assert.match(adminPage, /Recipient readiness/);
assert.match(navigation, /dashboard\/instructor\/payout-profile/);

console.log("PASS Phase 1E1 payout-profile app boundaries");
