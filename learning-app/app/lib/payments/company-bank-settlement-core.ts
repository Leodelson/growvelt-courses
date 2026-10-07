import type { CompanySettlementEvidence } from "@/app/lib/payments/company-settlement-core";

export type CompanyBankSettlementEvidenceInput = {
  bankCreditAmountMinor: number;
  bankStatementReference: string;
  bankCreditDate: string;
};

export type VerifiedCompanyBankSettlementEvidence = CompanyBankSettlementEvidenceInput & {
  settlementId: string;
  effectiveAmountMinor: number;
  settledAt: string;
};

/**
 * Validate an admin's manual bank-statement match against the amount and date
 * independently fetched from Paystack. This is an attestation, not a bank API
 * verification, and never authorizes release or transfer of seller funds.
 */
export function validateCompanyBankSettlementEvidence(
  providerEvidence: CompanySettlementEvidence,
  input: CompanyBankSettlementEvidenceInput,
): VerifiedCompanyBankSettlementEvidence {
  const statementReference = input.bankStatementReference.trim();
  const creditDate = input.bankCreditDate;
  const creditDateMs = Date.parse(`${creditDate}T00:00:00.000Z`);
  const settlementDateMs = Date.parse(providerEvidence.settledAt);

  if (!/^[1-9]\d{0,18}$/.test(providerEvidence.settlementId)
      || providerEvidence.effectiveAmountMinor === null
      || !Number.isSafeInteger(providerEvidence.effectiveAmountMinor)
      || providerEvidence.effectiveAmountMinor <= 0
      || !Number.isSafeInteger(input.bankCreditAmountMinor)
      || input.bankCreditAmountMinor <= 0
      || input.bankCreditAmountMinor !== providerEvidence.effectiveAmountMinor
      || !/^\d{4}-\d{2}-\d{2}$/.test(creditDate)
      || !Number.isFinite(creditDateMs)
      || new Date(creditDateMs).toISOString().slice(0, 10) !== creditDate
      || !Number.isFinite(settlementDateMs)
      || creditDateMs < Date.parse(`${providerEvidence.settledAt.slice(0, 10)}T00:00:00.000Z`)
      || statementReference.length < 3 || statementReference.length > 120
      || /[\u0000-\u001f\u007f]/.test(statementReference)) {
    throw new Error("Bank credit does not match the verified Paystack settlement.");
  }

  return {
    settlementId: providerEvidence.settlementId,
    effectiveAmountMinor: providerEvidence.effectiveAmountMinor,
    settledAt: providerEvidence.settledAt,
    bankCreditAmountMinor: input.bankCreditAmountMinor,
    bankStatementReference: statementReference,
    bankCreditDate: creditDate,
  };
}
