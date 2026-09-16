import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");

const [instructorData, adminData, instructorPage, adminPage, navigation, migration] = await Promise.all([
  read("app/lib/instructor/earnings.ts"),
  read("app/lib/admin/commercial-operations.ts"),
  read("app/dashboard/instructor/earnings/page.tsx"),
  read("app/dashboard/admin/commercial/page.tsx"),
  read("app/components/learning-shell-navigation.tsx"),
  read("supabase/migrations/20260904000000_add_instructor_earnings_visibility.sql"),
]);

assert.match(instructorData, /get_own_learning_instructor_earnings/);
assert.match(instructorData, /list_own_learning_instructor_earning_events/);
assert.doesNotMatch(instructorData, /createAdminClient/);
assert.match(adminData, /^import "server-only";/m);
assert.match(adminData, /createAdminClient\(\)\.rpc\("list_learning_commercial_operations"/);
assert.match(instructorPage, /payouts are not currently enabled/i);
assert.doesNotMatch(instructorPage, /<button[^>]*>[^<]*(withdraw|payout|transfer)/i);
assert.match(adminPage, /Read-only visibility into authoritative commercial allocations/i);
assert.match(navigation, /href="\/dashboard\/instructor\/earnings"/);
assert.match(navigation, /href="\/dashboard\/admin\/commercial"/);
assert.match(migration, /grant execute on function public\.get_own_learning_instructor_earnings\(\),public\.list_own_learning_instructor_earning_events\(\) to authenticated,postgres,service_role;/);
assert.match(migration, /grant execute on function public\.list_learning_commercial_operations\(uuid,integer\) to postgres,service_role;/);
assert.doesNotMatch(migration, /grant execute on function public\.list_learning_commercial_operations\(uuid,integer\) to authenticated/);

console.log("PASS Phase 1C2A instructor earnings app boundaries");
