import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migration = await readFile(path.join(root, "supabase", "migrations", "20260908000000_add_instructor_earnings_reservation_foundation.sql"), "utf8");

assert.match(migration, /create table public\.learning_instructor_earning_reservations/);
assert.match(migration, /earning_id bigint not null unique/);
assert.match(migration, /status text not null default 'reserved' check \(status = 'reserved'\)/);
assert.match(migration, /revoke all on public\.learning_instructor_earning_reservations from public,anon,authenticated/);
assert.match(migration, /security definer set search_path to ''/);
assert.match(migration, /Active administrator required/);
assert.match(migration, /assert_learning_approved_instructor\(p_instructor_id\)/);
assert.match(migration, /pg_advisory_xact_lock/);
assert.match(migration, /for update/);
assert.match(migration, /lock table public\.learning_payment_cases in share row exclusive mode/);
assert.match(migration, /Active financial protection prevents earnings reservation/);
assert.match(migration, /where id=earning_row\.id and status='available'/);
assert.match(migration, /'earning\.reserved'/);
assert.doesNotMatch(migration, /paystack\.com|transferrecipient|\/transfer|PAYSTACK_SECRET|sk_live_|sk_test_/i);
assert.doesNotMatch(migration, /learning_ledger_transactions\s*\(/);
assert.doesNotMatch(migration, /grant execute on function[\s\S]*reserve_learning_instructor_earning[\s\S]*to authenticated/);

console.log("PASS Phase 1E2 earnings-reservation app and privilege boundaries");
