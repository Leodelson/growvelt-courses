import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const nodeRequire = createRequire(import.meta.url);
const source = await readFile(new URL("../app/lib/payments/paystack-core.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const batchModule = { exports: {} };
runInNewContext(compiled, {
  module: batchModule, exports: batchModule.exports,
  require(specifier) { return specifier === "node:crypto" ? nodeRequire(specifier) : {}; },
});
const { parsePaystackTransferEvent } = batchModule.exports;
const batchPayload = { event: "transfer.success", data: {
  id: 99001, transfer_code: "TRF_batchlocal", reference: "lpb-live-batch-104-a1",
  amount: 125000, currency: "NGN", domain: "live",
} };
assert.equal(parsePaystackTransferEvent(batchPayload, "live")?.status, "succeeded");
assert.equal(parsePaystackTransferEvent(batchPayload, "test"), null);
assert.equal(parsePaystackTransferEvent({ ...batchPayload, data: { ...batchPayload.data, reference: "GL-00000000000000000000000000000000" } }, "live"), null);
assert.equal(parsePaystackTransferEvent({ ...batchPayload, data: { ...batchPayload.data, reference: "lpi-live-reservation-104" } }, "live")?.status, "succeeded");

const webhook = await readFile(new URL("../app/api/payments/paystack/webhook/route.ts", import.meta.url), "utf8");
assert.match(webhook, /receive_paystack_live_instructor_payout_batch_event/);
assert.match(webhook, /process_paystack_live_instructor_payout_batch_event/);
assert.match(webhook, /LEARNING_LIVE_PAYOUT_RECONCILIATION_ENABLED/);
assert.match(webhook, /LEARNING_LIVE_PAYOUT_BATCH_RECONCILIATION_ENABLED/);
const transfer = await readFile(new URL("../app/lib/admin/instructor-payout-transfer.ts", import.meta.url), "utf8");
assert.match(transfer, /transfer_submission_needed !== true/);
assert.match(transfer, /mark_learning_instructor_live_payout_batch_recovery_required/);
assert.match(transfer, /process_paystack_live_instructor_payout_batch_event/);
for (const route of [
  "../app/api/admin/commercial/payout-batches/approve/route.ts",
  "../app/api/admin/commercial/payout-batches/submit-live/route.ts",
  "../app/api/admin/commercial/payout-batches/finalize-live-otp/route.ts",
  "../app/api/admin/commercial/payout-batches/recover-live/route.ts",
]) {
  const content = await readFile(new URL(route, import.meta.url), "utf8");
  assert.match(content, /isSameOriginRequest/);
  assert.match(content, /is_growvelt_learning_admin/);
  assert.match(content, /LEARNING_LIVE_PAYOUT_BATCH_/);
}
const commercialPage = await readFile(new URL("../app/dashboard/admin/commercial/page.tsx", import.meta.url), "utf8");
const batchControl = await readFile(new URL("../app/components/admin/commercial-live-payout-batch-control.tsx", import.meta.url), "utf8");
assert.match(commercialPage, /CommercialLivePayoutBatchControl/);
assert.match(commercialPage, /LEARNING_LIVE_PAYOUT_BATCH_APPROVAL_ENABLED/);
assert.match(batchControl, /Approve and reserve selected earnings/);
assert.match(batchControl, /does not initiate a provider transfer/);
assert.match(batchControl, /Type \{batch\.batch_reference\} to initiate one Live transfer/);
assert.match(batchControl, /verification_required/);
assert.match(batchControl, /live_batch_balance_preflight_failed/);
assert.match(transfer, /get_learning_instructor_live_payout_batch_preflight/);
console.log("PASS Live payout batch reference routing and guarded application boundaries (no network)");
