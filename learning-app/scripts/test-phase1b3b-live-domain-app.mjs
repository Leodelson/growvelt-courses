import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const core = await import("../app/lib/payments/paystack-core.ts");
const livePayload = { event: "charge.success", data: { id: 160001, reference: "GL-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", amount: 10000, currency: "NGN", domain: "live", status: "success" } };
const testPayload = { ...livePayload, data: { ...livePayload.data, domain: "test" } };
assert.equal(core.parsePaystackChargeSuccess(livePayload, "live")?.domain, "live");
assert.equal(core.parsePaystackChargeSuccess(livePayload, "test"), null);
assert.equal(core.parsePaystackChargeSuccess(testPayload, "test")?.domain, "test");
assert.equal(core.parsePaystackChargeSuccess(testPayload, "live"), null);
assert.equal(core.parsePaystackTestChargeSuccess(livePayload), null);

const webhook = await readFile(new URL("../app/api/payments/paystack/webhook/route.ts", import.meta.url), "utf8");
const recovery = await readFile(new URL("../app/api/admin/payments/recover/route.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20260902000000_add_paystack_live_domain_foundation.sql", import.meta.url), "utf8");
assert.match(webhook, /parsePaystackChargeSuccess\(payload, config\.mode\)/);
assert.match(webhook, /receive_paystack_live_charge_event/);
assert.match(webhook, /config\.mode === "test" \? parsePaystackTestRefundEvent/);
assert.match(recovery, /verifyPaystackTransaction\(reference, "live"\)/);
assert.match(recovery, /receive_paystack_live_verified_transaction/);
assert.match(migration, /paystack_domain/);
assert.match(migration, /Provider event domain does not match payment attempt/);
assert.match(migration, /revoke all on function public\.protect_learning_payment_attempt_domain/);
console.log("PASS Phase 1B3B app-level domain parsing, live charge routing, test-only refund/dispute routing, and server-only live recovery boundaries");
