import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [route, operations, migration, sandboxRoute, sandboxOperations, liveReceipts, webhook, adminPage, liveSubmission, liveSubmissionRoute, paystack, otpMigration, otpRoute, recoveryRoute] = await Promise.all([
  readFile("app/api/admin/commercial/payout-items/approve/route.ts", "utf8"),
  readFile("app/lib/admin/instructor-payout-transfer.ts", "utf8"),
  readFile("supabase/migrations/20261115000000_add_instructor_live_payout_approval.sql", "utf8"),
  readFile("app/api/admin/commercial/payout-items/submit-test/route.ts", "utf8"),
  readFile("supabase/migrations/20260909000000_add_instructor_payout_test_transfer_foundation.sql", "utf8"),
  readFile("supabase/migrations/20261116000000_add_instructor_live_payout_event_receipts.sql", "utf8"),
  readFile("app/api/payments/paystack/webhook/route.ts", "utf8"),
  readFile("app/dashboard/admin/commercial/page.tsx", "utf8"),
  readFile("supabase/migrations/20261117000000_add_instructor_live_transfer_submission_gate.sql", "utf8"),
  readFile("app/api/admin/commercial/payout-items/submit-live/route.ts", "utf8"),
  readFile("app/lib/payments/paystack.ts", "utf8"),
  readFile("supabase/migrations/20261118000000_add_instructor_live_payout_otp_attempt.sql", "utf8"),
  readFile("app/api/admin/commercial/payout-items/finalize-live-otp/route.ts", "utf8"),
  readFile("app/api/admin/commercial/payout-items/recover-live/route.ts", "utf8"),
]);
assert.match(route, /isSameOriginRequest\(request\)/);
assert.match(route, /is_growvelt_learning_admin/);
assert.match(route, /LEARNING_LIVE_PAYOUT_APPROVAL_ENABLED !== "true"/);
assert.match(route, /approveInstructorLivePayout/);
assert.match(operations, /approve_learning_instructor_live_payout_item/);
assert.match(operations, /LEARNING_LIVE_PAYOUT_SUBMISSION_ENABLED !== "true"/);
assert.match(operations, /begin_learning_instructor_live_transfer/);
assert.match(operations, /mark_learning_instructor_live_transfer_recovery_required/);
assert.match(operations, /record_learning_instructor_live_transfer_submission/);
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
assert.match(liveSubmission, /item\.provider_domain<>'live' or item\.status<>'approved'/);
assert.match(liveSubmission, /succeeded_count<>1 or live_count<>1/);
assert.match(liveSubmission, /lock table public\.learning_payment_cases in share row exclusive mode/);
assert.match(liveSubmission, /p_provider_status not in \('otp','pending'\)/);
assert.match(liveSubmission, /status='recovery_required'/);
assert.match(liveSubmission, /revoke all on function public\.begin_learning_instructor_live_transfer/);
assert.match(liveSubmissionRoute, /LEARNING_LIVE_PAYOUT_SUBMISSION_ENABLED !== "true"/);
assert.match(liveSubmissionRoute, /isSameOriginRequest/);
assert.match(liveSubmissionRoute, /is_growvelt_learning_admin/);
assert.doesNotMatch(liveSubmissionRoute, /amountMinor|recipientCode|secretKey|otp/);
assert.match(paystack, /getPaystackLiveConfig\(false\)/);
assert.match(paystack, /data\?\.domain !== "live"/);
assert.match(paystack, /data\?\.status !== "otp" && data\?\.status !== "pending"/);
assert.match(paystack, /finalizePaystackLiveTransfer/);
assert.match(paystack, /transfer\/finalize_transfer/);
assert.match(paystack, /verifyPaystackLiveTransfer/);
assert.match(otpMigration, /payout_item_id bigint not null unique/);
assert.match(otpMigration, /status in \('started','submitted','needs_attention'\)/);
assert.match(otpMigration, /item\.initiated_at < now\(\)-interval '25 minutes'/);
assert.match(otpMigration, /Active financial protection blocks Live OTP finalization/);
assert.doesNotMatch(otpMigration, /otp (text|varchar|character)/i);
assert.match(otpRoute, /LEARNING_LIVE_PAYOUT_OTP_ENABLED !== "true"/);
assert.match(otpRoute, /isSameOriginRequest/);
assert.match(otpRoute, /is_growvelt_learning_admin/);
assert.match(otpRoute, /raw\.length > 1024/);
assert.doesNotMatch(otpRoute, /console\.|logger\./);
assert.match(recoveryRoute, /LEARNING_LIVE_PAYOUT_RECONCILIATION_ENABLED !== "true"/);
assert.match(recoveryRoute, /isSameOriginRequest/);
assert.match(recoveryRoute, /is_growvelt_learning_admin/);
assert.match(operations, /verifyPaystackLiveTransfer\(item\.payout_item_reference\)/);
assert.match(operations, /receive_paystack_live_transfer_provider_event/);
console.log("PASS gated Live payout approval, submission, OTP and reconciliation boundaries");
