import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source=(path)=>readFile(new URL(`../${path}`,import.meta.url),"utf8");
const [policy,terms,footer,purchase,webhook,refundRoute,notices,runbook,migration]=await Promise.all([
  source("app/refund-policy/page.tsx"),source("app/terms-of-service/page.tsx"),source("app/components/Footer.tsx"),
  source("app/components/learning/enrollment-button.tsx"),source("app/api/payments/paystack/webhook/route.ts"),
  source("app/api/admin/payments/refund/route.ts"),source("app/lib/email/payment-notifications.ts"),
  source("docs/phase1b2c-payment-policy-runbook.md"),source("supabase/migrations/20260901000000_add_payment_policy_operational_gate.sql")
]);
assert.match(policy,/14 calendar days/);assert.match(policy,/less than 20%/);assert.match(policy,/refund@growvelt\.com/);assert.match(policy,/mandatory consumer rights/);
assert.match(terms,/Refund Policy/);assert.match(footer,/href="\/refund-policy"/);assert.match(purchase,/displayedPrice/);assert.match(purchase,/Paystack processes payment/);
for(const type of ["payment_access_ready","payment_attention","refund_requested","refund_processed","refund_attention","access_revoked","operator_dispute","operator_reconciliation"]) assert.match(notices,new RegExp(type));
assert.match(notices,/Idempotency-Key/);assert.match(notices,/learning_payment_notifications/);assert.match(refundRoute,/refund-requested:/);assert.match(webhook,/payment-ready:/);assert.match(webhook,/access-revoked:chargeback/);
assert.match(migration,/exceptional_admin_refund/);assert.match(migration,/routine_refund_window_days/);assert.match(migration,/one_active_learner_course/);assert.match(migration,/certificate\.financial_abuse_revoked/);
assert.match(runbook,/Never repair financial truth with ad hoc SQL/);assert.doesNotMatch([policy,terms,footer,purchase,webhook,refundRoute,notices,runbook,migration].join("\n"),/sk_(test|live)_[A-Za-z0-9]+/);
console.log("PASS Phase 1B2C policy, acknowledgement, notification, repurchase, certificate, and runbook boundaries");
