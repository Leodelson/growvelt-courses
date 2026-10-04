import assert from "node:assert/strict";
import { verifyCompanySettlementEvidence } from "../app/lib/payments/company-settlement-core.ts";

const reference = `CP-${"A".repeat(32)}`;
const input = { settlementId: "9001", transactionId: "9002", reference, requestedAmountMinor: 10000 };
const settlement = { id: 9001, domain: "live", status: "success", currency: "NGN",
  total_processed: 20000, settlement_date: "2026-10-02T09:00:00.000Z" };
const transaction = { id: 9002, reference, domain: "live", status: "success", currency: "NGN",
  amount: 10000, requested_amount: 10000 };
const envelope = (rows, page = 1, pageCount = 1) =>
  ({ status: true, data: rows, meta: { page, pageCount } });
const pages = (settlements, transactions) => async (kind, _id, page) =>
  kind === "settlements" ? settlements[page - 1] : transactions[page - 1];
const good = pages([envelope([settlement])], [envelope([transaction])]);
const evidence = await verifyCompanySettlementEvidence(input, good);
assert.deepEqual(evidence, { ...input, settledAt: settlement.settlement_date });

const reject = async (changedInput, reader) => {
  await assert.rejects(verifyCompanySettlementEvidence(changedInput, reader));
};
await reject({ ...input, transactionId: "9003" }, good);
await reject({ ...input, requestedAmountMinor: 10001 }, good);
await reject(input, pages([envelope([{ ...settlement, status: "pending" }])], [envelope([transaction])]));
await reject(input, pages([envelope([{ ...settlement, domain: "test" }])], [envelope([transaction])]));
await reject(input, pages([envelope([settlement])], [envelope([{ ...transaction, reference: `CP-${"B".repeat(32)}` }])]));
await reject(input, pages([envelope([settlement])], [envelope([{ ...transaction, requested_amount: 9999 }])]));
await reject(input, pages([envelope([settlement], 1, 2)], [envelope([transaction])]));
await reject(input, pages([envelope([settlement])], [envelope([transaction], 2, 2)]));
await reject(input, pages([envelope([settlement, settlement])], [envelope([transaction])]));
await reject(input, pages([envelope([settlement])], [envelope([transaction, transaction])]));
await reject(input, pages([envelope([settlement])], [envelope([{ ...transaction, id: Number.MAX_SAFE_INTEGER + 1 }])]));

const paged = pages(
  [envelope([{ id: 1 }], 1, 2), envelope([settlement], 2, 2)],
  [envelope([{ id: 2 }], 1, 2), envelope([transaction], 2, 2)],
);
assert.deepEqual(await verifyCompanySettlementEvidence(input, paged), evidence);
console.log("PASS company settlement evidence matches a successful live settlement and its exact transaction, failing closed otherwise");
