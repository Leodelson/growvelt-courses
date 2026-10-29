import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../app/lib/payments/paystack.ts", import.meta.url), "utf8");
const start = source.indexOf("export async function findPaystackRefundIdForTransaction");
const end = source.indexOf("export type PaystackDispute", start);
assert.ok(start >= 0 && end > start);
const compiled = ts.transpileModule(source.slice(start, end), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const now = "2026-10-29T12:00:00.000Z";
const target = { transactionId: "12345", amountMinor: 10000, domain: "live", requestedAt: now };
const matching = { id: 321, transaction: 12345, amount: 10000, currency: "NGN", domain: "live", created_at: "2026-10-29T12:00:02.000Z" };

async function lookup(data, meta) {
  let call;
  const fetch = async (url, options) => {
    call = { url: String(url), options };
    return { ok: true, json: async () => ({ status: true, data, ...(meta === undefined ? {} : { meta }) }) };
  };
  const exports = {};
  new Function("exports", "fetch", "getPaystackLiveConfig", "getPaystackTestConfig", "AbortSignal", compiled)(
    exports, fetch, () => ({ secretKey: "local-fixture" }), () => ({ secretKey: "local-fixture" }), AbortSignal,
  );
  const result = await exports.findPaystackRefundIdForTransaction(target);
  assert.match(call.url, /\/refund\?transaction=12345&perPage=100&page=1/);
  assert.equal(call.options.method, undefined, "Lookup must not create another provider refund");
  return result;
}

assert.equal(await lookup([matching]), "321");
assert.equal(await lookup([]), null, "No match remains unresolved, never retried");
await assert.rejects(lookup([{ ...matching, transaction: 99999 }]), /unverifiable records/);
await assert.rejects(lookup([{ ...matching, created_at: "2026-10-29T11:00:00.000Z" }]), /unverifiable records/);
await assert.rejects(lookup([matching, { ...matching, id: 322 }]), /Multiple matching refunds/);
await assert.rejects(lookup([matching], { pageCount: 2 }), /manual review/);
await assert.rejects(lookup(Array.from({ length: 50 }, (_, index) => ({ ...matching, id: index + 1 }))), /manual review/);
console.log("PASS Phase 1B2A uncertain-refund lookup remains read-only and fail-closed");
