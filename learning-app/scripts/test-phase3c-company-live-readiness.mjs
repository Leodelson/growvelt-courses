import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parsePaystackCompanyChargeSuccess } from "../app/lib/payments/paystack-core.ts";

const reference = `CP-${"A".repeat(32)}`;
const charge = (domain) => ({ event: "charge.success", data: { id: 42001, reference, amount: 1025381, currency: "NGN", domain, status: "success" } });
assert.equal(parsePaystackCompanyChargeSuccess(charge("test"), "live"), null);
assert.equal(parsePaystackCompanyChargeSuccess(charge("live"), "test"), null);
assert.equal(parsePaystackCompanyChargeSuccess(charge("test"), "test")?.domain, "test");
assert.equal(parsePaystackCompanyChargeSuccess(charge("live"), "live")?.domain, "live");

const read = async (path) => readFile(new URL(path, import.meta.url), "utf8");
const migration = await read("../../supabase/migrations/20260943000000_guard_company_paystack_payment_domains.sql");
const checkout = await read("../app/api/company/workspaces/[workspaceId]/purchases/[purchaseId]/checkout/route.ts");
const webhook = await read("../app/api/payments/paystack/webhook/route.ts");
const reconciliation = await read("../app/api/company/payments/paystack/reconcile/route.ts");
assert.match(migration, /paystack_domain text not null default 'test'/);
assert.match(migration, /p_domain <> attempt_row\.paystack_domain/);
assert.match(migration, /p_amount_minor <> attempt_row\.amount_minor/);
assert.match(migration, /Submitted company payment domain is immutable/);
assert.match(checkout, /PAYMENTS_LIVE_COMPANY_CHECKOUT_ENABLED !== "true"/);
assert.match(checkout, /admin\.rpc\("is_learning_company_live_accounting_ready"\)/);
assert.match(checkout, /accountingError \|\| accountingReady !== true/);
assert.ok(checkout.indexOf('admin.rpc("is_learning_company_live_accounting_ready")') < checkout.indexOf('supabase.rpc("start_learning_company_paid_course_checkout"'), "Live accounting capability must be checked before creating a checkout attempt");
assert.match(checkout, /set_learning_company_paid_checkout_domain/);
assert.match(checkout, /config\.mode === "live" \? initializePaystackLiveTransaction : initializePaystackTestTransaction/);
assert.match(webhook, /verifyPaystackCompanyTransaction\(companyCharge\.reference, config\.mode\)/);
assert.match(reconciliation, /verifyPaystackCompanyTransaction\(reference, getPaystackConfig\(false\)\.mode\)/);
console.log("PASS Phase 3C company domain separation and disabled-by-default live checkout wiring");
