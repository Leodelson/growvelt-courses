import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Execute the real provider adapter with an in-memory HTTP fake. No Paystack
// request, credential, database connection, or payment is involved.
const source = await readFile(new URL("../app/lib/payments/paystack.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
let reply;
let lastRequest;
runInNewContext(compiled, {
  module, exports: module.exports, process: { env: {} }, AbortSignal,
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
const { initiatePaystackLiveTransfer, finalizePaystackLiveTransfer, verifyPaystackLiveTransfer } = module.exports;
const reference = "lpi-live-reservation-101";
const transfer = { domain: "live", id: 12345, transfer_code: "TRF_localfake", reference, amount: 7500, currency: "NGN" };
const success = data => ({ body: { status: true, data } });

reply = success({ ...transfer, status: "otp" });
assert.equal((await initiatePaystackLiveTransfer({ recipientCode: "RCP_localfake", amountMinor: 7500, reference })).status, "otp");
assert.equal(lastRequest.url, "https://api.paystack.co/transfer");
assert.equal(JSON.parse(lastRequest.options.body).reference, reference);
assert.equal(JSON.parse(lastRequest.options.body).amount, 7500);

for (const bad of [
  { ...transfer, status: "otp", domain: "test" },
  { ...transfer, status: "otp", amount: 7501 },
  { ...transfer, status: "success" },
]) {
  reply = success(bad);
  await assert.rejects(initiatePaystackLiveTransfer({ recipientCode: "RCP_localfake", amountMinor: 7500, reference }));
}
reply = new Error("network timeout");
await assert.rejects(initiatePaystackLiveTransfer({ recipientCode: "RCP_localfake", amountMinor: 7500, reference }));

reply = success({ ...transfer, status: "pending" });
assert.equal((await finalizePaystackLiveTransfer({ transferCode: transfer.transfer_code, transferId: "12345", reference, amountMinor: 7500, otp: "123456" })).status, "pending");
assert.equal(lastRequest.url, "https://api.paystack.co/transfer/finalize_transfer");
assert.deepEqual(JSON.parse(lastRequest.options.body), { transfer_code: transfer.transfer_code, otp: "123456" });
for (const bad of [
  { ...transfer, status: "success", domain: "test" },
  { ...transfer, status: "pending", id: 54321 },
  { ...transfer, status: "pending", reference: "lpi-live-reservation-999" },
]) {
  reply = success(bad);
  await assert.rejects(finalizePaystackLiveTransfer({ transferCode: transfer.transfer_code, transferId: "12345", reference, amountMinor: 7500, otp: "123456" }));
}
await assert.rejects(finalizePaystackLiveTransfer({ transferCode: transfer.transfer_code, transferId: "12345", reference, amountMinor: 7500, otp: "12345" }));

reply = success({ ...transfer, status: "success" });
assert.equal((await verifyPaystackLiveTransfer(reference)).status, "succeeded");
assert.equal(lastRequest.url, `https://api.paystack.co/transfer/verify/${reference}`);
for (const status of ["failed", "reversed", "pending", "otp", "abandoned", "blocked", "rejected", "received"]) {
  reply = success({ ...transfer, status });
  assert.equal((await verifyPaystackLiveTransfer(reference)).status, status);
}
for (const bad of [
  { ...transfer, status: "success", domain: "test" },
  { ...transfer, status: "success", amount: 0 },
  { ...transfer, status: "unknown" },
  { ...transfer, status: "success", reference: "lpi-live-reservation-999" },
]) {
  reply = success(bad);
  await assert.rejects(verifyPaystackLiveTransfer(reference));
}
reply = { ok: false, body: { status: false } };
await assert.rejects(verifyPaystackLiveTransfer(reference));
console.log("PASS Live transfer provider contract simulations (no network)");
