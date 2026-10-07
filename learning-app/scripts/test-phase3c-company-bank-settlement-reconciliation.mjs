import assert from "node:assert/strict";
import { verifyCompanySettlementEvidence } from "../app/lib/payments/company-settlement-core.ts";
import { validateCompanyBankSettlementEvidence } from "../app/lib/payments/company-bank-settlement-core.ts";

const reference = `CP-${"A".repeat(32)}`;
const lookup = { settlementId: "9001", transactionId: "9002", reference, requestedAmountMinor: 10000 };
const settlement = { id: 9001, domain: "live", status: "success", currency: "NGN",
  total_processed: 20000, effective_amount: 19750, settlement_date: "2026-10-02T09:00:00.000Z" };
const transaction = { id: 9002, reference, domain: "live", status: "success", currency: "NGN",
  amount: 10000, requested_amount: 10000 };
const envelope = (rows) => ({ status: true, data: rows, meta: { page: 1, pageCount: 1 } });
const evidence = await verifyCompanySettlementEvidence(lookup, async (kind) =>
  envelope(kind === "settlements" ? [settlement] : [transaction]));

const input = { bankCreditAmountMinor: 19750, bankStatementReference: "BANK-2026-10-02-8842", bankCreditDate: "2026-10-03" };
assert.deepEqual(validateCompanyBankSettlementEvidence(evidence, input), {
  ...input, settlementId: "9001", effectiveAmountMinor: 19750, settledAt: settlement.settlement_date,
});
assert.throws(() => validateCompanyBankSettlementEvidence(evidence, { ...input, bankCreditAmountMinor: 19749 }));
assert.throws(() => validateCompanyBankSettlementEvidence(evidence, { ...input, bankCreditAmountMinor: 0 }));
assert.throws(() => validateCompanyBankSettlementEvidence(evidence, { ...input, bankCreditDate: "2026-10-01" }));
assert.throws(() => validateCompanyBankSettlementEvidence(evidence, { ...input, bankCreditDate: "2026-02-30" }));
assert.throws(() => validateCompanyBankSettlementEvidence(evidence, { ...input, bankStatementReference: "  " }));
assert.throws(() => validateCompanyBankSettlementEvidence(evidence, { ...input, bankStatementReference: "bad\nreference" }));
assert.throws(() => validateCompanyBankSettlementEvidence({ ...evidence, effectiveAmountMinor: null }, input));

console.log("PASS company Paystack settlement bank reconciliation requires exact batch credit, valid statement reference, and non-preceding bank date");
