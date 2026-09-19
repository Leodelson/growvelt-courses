import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile("supabase/migrations/20260910000000_add_instructor_payout_transfer_reconciliation.sql", "utf8");
const webhook = await readFile("app/api/payments/paystack/webhook/route.ts", "utf8");
const recovery = await readFile("app/lib/admin/instructor-payout-transfer.ts", "utf8");
const operations = await readFile("app/lib/admin/commercial-operations.ts", "utf8");
const reprocessRoute = await readFile("app/api/admin/commercial/payout-items/reprocess-event/route.ts", "utf8");

assert.match(migration, /create table if not exists public\.learning_instructor_payout_provider_events/);
assert.match(migration, /drop index if exists public\.learning_instructor_payout_reconciliation_findings_open_idx[\s\S]*alter table public\.learning_instructor_payout_reconciliation_findings drop column status, drop column resolved_at/);
assert.match(migration, /provider_event_id text not null unique/);
assert.match(migration, /provenance text not null check \(provenance in \('provider_webhook','provider_api'\)\)/);
assert.match(migration, /create table if not exists public\.learning_instructor_payout_settlements/);
assert.match(migration, /payout_item_id bigint not null unique/);
assert.match(migration, /create table if not exists public\.learning_instructor_payout_reconciliation_findings/);
assert.match(migration, /create table public\.learning_instructor_payout_reconciliation_finding_events/);
assert.match(migration, /Payout reconciliation findings are immutable/);
assert.match(migration, /reprocess_learning_instructor_payout_provider_event/);
assert.match(migration, /create or replace function public\.receive_paystack_test_transfer_event/);
assert.match(migration, /create or replace function public\.record_learning_instructor_test_transfer_verification/);
assert.match(migration, /receive_paystack_test_transfer_provider_event/);
assert.match(migration, /process_learning_instructor_payout_provider_event/);
assert.match(migration, /if ev\.provider_status='pending'/);
assert.match(migration, /already_processed/);
assert.match(migration, /lock table public\.learning_payment_cases in share row exclusive mode/);
assert.match(migration, /'instructor_payout_settlement'/);
assert.match(migration, /liability\.instructor_earnings_available/);
assert.match(migration, /settled_payout_reversed_requires_controlled_resolution/);
assert.match(migration, /provider_outcome_financially_blocked/);
assert.match(migration, /status='paid'/);
assert.match(migration, /status='available',reserved_at=null/);
assert.match(migration, /revoke all on public\.learning_instructor_payout_provider_events/);
assert.match(migration, /to postgres,service_role/);
assert.doesNotMatch(migration, /initiatePaystack/);

assert.match(webhook, /verifyPaystackSignature/);
assert.match(webhook, /receive_paystack_test_transfer_provider_event/);
assert.match(webhook, /process_learning_instructor_payout_provider_event/);
assert.match(webhook, /p_provenance: "provider_webhook"/);
assert.doesNotMatch(webhook, /transfer.*secretKey/i);

assert.match(recovery, /verifyPaystackTestTransfer/);
assert.match(recovery, /p_provenance: "provider_api"/);
assert.match(recovery, /process_learning_instructor_payout_provider_event/);
assert.match(recovery, /recoverInstructorTestPayout[\s\S]*?verifyPaystackTestTransfer/);
assert.match(operations, /list_learning_instructor_payout_reconciliation_findings/);
assert.match(reprocessRoute, /isSameOriginRequest/);
assert.match(reprocessRoute, /is_growvelt_learning_admin/);
assert.match(reprocessRoute, /reprocess_learning_instructor_payout_provider_event/);
assert.doesNotMatch(reprocessRoute, /amountMinor|recipientCode|instructorId|transferId|providerStatus/);

console.log("Phase 1E4 payout transfer reconciliation application boundary checks passed.");
