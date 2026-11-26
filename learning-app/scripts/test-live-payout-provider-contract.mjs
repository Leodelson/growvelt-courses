import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Execute the real provider adapter with an in-memory HTTP fake. No Paystack
// request, credential, database connection, or payment is involved.
const source = await readFile(new URL("../app/lib/payments/paystack.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const providerModule = { exports: {} };
let reply;
let lastRequest;
runInNewContext(compiled, {
  module: providerModule, exports: providerModule.exports, process: { env: {} }, AbortSignal,
  require(specifier) {
    if (specifier.endsWith("paystack-config")) return { resolvePaystackConfiguration: () => ({ mode: "live", secretKey: "sk_live_local_fake", checkoutEnabled: false }) };
    return {};
  },
  async fetch(url, options) {
    lastRequest = { url, options };
    if (reply instanceof Error) throw reply;
    return { ok: reply.ok ?? true, async json() { return reply.body; } };
  },
});
const { assertPaystackLiveBalanceCoversPayout, initiatePaystackLivePayoutBatchTransfer,
  finalizePaystackLiveTransfer, verifyPaystackLiveTransfer } = providerModule.exports;
const success = data => ({ body: { status: true, data } });

const batchReference = "lpb-live-batch-101-a1";
const batchTransfer = { domain: "live", id: 12346, transfer_code: "TRF_batchfake", reference: batchReference,
  amount: 100000, currency: "NGN" };
reply = { body: { status: true, data: [{ currency: "NGN", balance: 110000 }] } };
assert.equal((await assertPaystackLiveBalanceCoversPayout(100000)).requiredAmountMinor, 110000);
assert.equal(lastRequest.url, "https://api.paystack.co/balance");
assert.equal(lastRequest.options.headers.Authorization, "Bearer sk_live_local_fake");
for (const balance of [109999, "110000", null]) {
  reply = { body: { status: true, data: [{ currency: "NGN", balance }] } };
  await assert.rejects(assertPaystackLiveBalanceCoversPayout(100000));
}
reply = { body: { status: true, data: [{ currency: "GHS", balance: 900000 }, { currency: "NGN", balance: 110000 }] } };
assert.equal((await assertPaystackLiveBalanceCoversPayout(100000)).requiredAmountMinor, 110000);
reply = { ok: false, body: { status: false } };
await assert.rejects(assertPaystackLiveBalanceCoversPayout(100000));

reply = success({ ...batchTransfer, status: "otp" });
assert.equal((await initiatePaystackLivePayoutBatchTransfer({ recipientCode: "RCP_localfake",
  amountMinor: 100000, reference: batchReference })).status, "otp");
assert.equal(JSON.parse(lastRequest.options.body).reference, batchReference);
for (const bad of [
  { ...batchTransfer, status: "otp", amount: 99999 },
  { ...batchTransfer, status: "otp", domain: "test" },
  { ...batchTransfer, status: "success" },
]) {
  reply = success(bad);
  await assert.rejects(initiatePaystackLivePayoutBatchTransfer({ recipientCode: "RCP_localfake",
    amountMinor: 100000, reference: batchReference }));
}
await assert.rejects(initiatePaystackLivePayoutBatchTransfer({ recipientCode: "RCP_localfake",
  amountMinor: 99999, reference: batchReference }));

reply = success({ ...batchTransfer, status: "pending" });
assert.equal((await finalizePaystackLiveTransfer({ transferCode: batchTransfer.transfer_code, transferId: "12346", reference: batchReference, amountMinor: 100000, otp: "123456" })).status, "pending");
assert.equal(lastRequest.url, "https://api.paystack.co/transfer/finalize_transfer");
assert.deepEqual(JSON.parse(lastRequest.options.body), { transfer_code: batchTransfer.transfer_code, otp: "123456" });
for (const bad of [
  { ...batchTransfer, status: "success", domain: "test" },
  { ...batchTransfer, status: "pending", id: 54321 },
  { ...batchTransfer, status: "pending", reference: "lpb-live-batch-999-a1" },
]) {
  reply = success(bad);
  await assert.rejects(finalizePaystackLiveTransfer({ transferCode: batchTransfer.transfer_code, transferId: "12346", reference: batchReference, amountMinor: 100000, otp: "123456" }));
}
await assert.rejects(finalizePaystackLiveTransfer({ transferCode: batchTransfer.transfer_code, transferId: "12346", reference: batchReference, amountMinor: 100000, otp: "12345" }));

reply = success({ ...batchTransfer, status: "success" });
assert.equal((await verifyPaystackLiveTransfer(batchReference)).status, "succeeded");
assert.equal(lastRequest.url, `https://api.paystack.co/transfer/verify/${batchReference}`);
for (const status of ["failed", "reversed", "pending", "otp", "abandoned", "blocked", "rejected", "received"]) {
  reply = success({ ...batchTransfer, status });
  assert.equal((await verifyPaystackLiveTransfer(batchReference)).status, status);
}
for (const bad of [
  { ...batchTransfer, status: "success", domain: "test" },
  { ...batchTransfer, status: "success", amount: 0 },
  { ...batchTransfer, status: "unknown" },
  { ...batchTransfer, status: "success", reference: "lpb-live-batch-999-a1" },
]) {
  reply = success(bad);
  await assert.rejects(verifyPaystackLiveTransfer(batchReference));
}
reply = { ok: false, body: { status: false } };
await assert.rejects(verifyPaystackLiveTransfer(batchReference));
reply = success({ ...batchTransfer, status: "success" });
assert.equal((await verifyPaystackLiveTransfer(batchReference)).status, "succeeded");
console.log("PASS Live transfer provider contract simulations (no network)");
