import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { verifyCompanyLiveTransferEvidence } from "../app/lib/payments/company-transfer-core.ts";

const input = { reference: `lcs-${"a".repeat(32)}`, recipientCode: "RCP_Example123", amountMinor: 12500 };
const providerTransfer = {
  status: true,
  data: {
    id: 7654321,
    transfer_code: "TRF_Example123",
    reference: input.reference,
    amount: input.amountMinor,
    currency: "NGN",
    domain: "live",
    status: "success",
    source: "balance",
    recipient: { recipient_code: input.recipientCode, currency: "NGN", domain: "live" },
  },
};
const evidence = await verifyCompanyLiveTransferEvidence(input, async (reference) => {
  assert.equal(reference, input.reference);
  return providerTransfer;
});
assert.deepEqual(evidence, {
  transferId: "7654321", transferCode: "TRF_Example123", ...input,
  currency: "NGN", domain: "live", status: "succeeded",
});

const reject = (candidate, response = providerTransfer) =>
  assert.rejects(verifyCompanyLiveTransferEvidence(candidate, async () => response));
await reject({ ...input, reference: "not-a-company-reference" });
await reject({ ...input, recipientCode: "bad-recipient" });
await reject({ ...input, amountMinor: 0 });
await reject(input, { ...providerTransfer, status: false });
await reject(input, { ...providerTransfer, data: { ...providerTransfer.data, reference: `lcs-${"b".repeat(32)}` } });
await reject(input, { ...providerTransfer, data: { ...providerTransfer.data, amount: input.amountMinor + 1 } });
await reject(input, { ...providerTransfer, data: { ...providerTransfer.data, domain: "test" } });
await reject(input, { ...providerTransfer, data: { ...providerTransfer.data, status: "pending" } });
await reject(input, { ...providerTransfer, data: { ...providerTransfer.data, source: "other" } });
await reject(input, { ...providerTransfer, data: { ...providerTransfer.data,
  recipient: { ...providerTransfer.data.recipient, recipient_code: "RCP_Wrong" } } });
await reject(input, { ...providerTransfer, data: { ...providerTransfer.data,
  recipient: { ...providerTransfer.data.recipient, domain: "test" } } });
await reject(input, { ...providerTransfer, data: { ...providerTransfer.data, id: Number.MAX_SAFE_INTEGER + 1 } });

// Guard the adapter boundary: a verification helper may perform only the
// documented read-only GET, and must select Live credentials explicitly.
const paystack = await readFile(new URL("../app/lib/payments/paystack.ts", import.meta.url), "utf8");
const start = paystack.indexOf("export async function verifyPaystackCompanyLiveTransfer(");
assert.notEqual(start, -1);
const end = paystack.indexOf("\n}\n", start);
assert.notEqual(end, -1);
const adapter = paystack.slice(start, end);
assert.match(adapter, /getPaystackLiveConfig\(false\)/);
assert.match(adapter, /\/transfer\/verify\//);
assert.match(adapter, /method:\s*["']GET["']/);
assert.doesNotMatch(adapter, /method:\s*["']POST["']/);
assert.doesNotMatch(adapter, /\/transfer["'`]/);

console.log("PASS company Live transfer verification accepts only exact successful transfer evidence; adapter is read-only");
