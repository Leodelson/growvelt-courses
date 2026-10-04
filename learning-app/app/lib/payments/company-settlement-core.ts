// Read-only Paystack settlement evidence for a future company seller release.
// Keep this separate from the release ledger and payout transfer paths.
type Page = { status?: unknown; data?: unknown; meta?: unknown };
type RecordRow = Record<string, unknown>;

export type CompanySettlementLookup = {
  settlementId: string;
  transactionId: string;
  reference: string;
  requestedAmountMinor: number;
};

export type CompanySettlementEvidence = {
  settlementId: string;
  transactionId: string;
  reference: string;
  requestedAmountMinor: number;
  settledAt: string;
};

function numericId(value: unknown): string | null {
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
  return typeof value === "string" && /^[1-9]\d*$/.test(value) ? value : null;
}

function positiveMinor(value: unknown): number | null {
  const amount = typeof value === "number" ? value
    : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

function pageRows(payload: unknown, expectedPage: number): { rows: RecordRow[]; pageCount: number } {
  const page = payload as Page | null;
  const meta = page?.meta as RecordRow | null;
  if (page?.status !== true || !Array.isArray(page.data) || !meta
      || meta.page !== expectedPage || !Number.isSafeInteger(meta.pageCount)
      || (meta.pageCount as number) < expectedPage || (meta.pageCount as number) > 100
      || !page.data.every((row: unknown) => row !== null && typeof row === "object" && !Array.isArray(row))) {
    throw new Error("Paystack settlement evidence is incomplete.");
  }
  return { rows: page.data as RecordRow[], pageCount: meta.pageCount as number };
}

export async function verifyCompanySettlementEvidence(
  input: CompanySettlementLookup,
  readPage: (kind: "settlements" | "transactions", settlementId: string, page: number) => Promise<unknown>,
): Promise<CompanySettlementEvidence> {
  if (!numericId(input.settlementId) || !numericId(input.transactionId)
      || !/^CP-[A-F0-9]{32}$/.test(input.reference)
      || positiveMinor(input.requestedAmountMinor) === null) {
    throw new Error("Invalid company settlement lookup.");
  }

  let settlement: RecordRow | null = null;
  for (let page = 1, pageCount = 1; page <= pageCount; page += 1) {
    const result = pageRows(await readPage("settlements", input.settlementId, page), page);
    pageCount = result.pageCount;
    for (const row of result.rows) {
      if (numericId(row.id) !== input.settlementId) continue;
      if (settlement) throw new Error("Duplicate Paystack settlement evidence.");
      settlement = row;
    }
  }
  if (!settlement || settlement.domain !== "live" || settlement.status !== "success"
      || settlement.currency !== "NGN" || typeof settlement.settlement_date !== "string"
      || !Number.isFinite(Date.parse(settlement.settlement_date))
      || positiveMinor(settlement.total_processed) === null
      || (positiveMinor(settlement.total_processed) ?? 0) < input.requestedAmountMinor) {
    throw new Error("Paystack settlement is not confirmed for this live charge.");
  }

  let transaction: RecordRow | null = null;
  for (let page = 1, pageCount = 1; page <= pageCount; page += 1) {
    const result = pageRows(await readPage("transactions", input.settlementId, page), page);
    pageCount = result.pageCount;
    for (const row of result.rows) {
      if (numericId(row.id) !== input.transactionId && row.reference !== input.reference) continue;
      if (transaction) throw new Error("Duplicate Paystack settlement transaction evidence.");
      transaction = row;
    }
  }
  if (!transaction || numericId(transaction.id) !== input.transactionId
      || transaction.reference !== input.reference || transaction.domain !== "live"
      || transaction.status !== "success" || transaction.currency !== "NGN"
      || positiveMinor(transaction.requested_amount) !== input.requestedAmountMinor
      || (positiveMinor(transaction.amount) ?? 0) < input.requestedAmountMinor) {
    throw new Error("Paystack settlement transaction does not match the company sale.");
  }
  return {
    settlementId: input.settlementId, transactionId: input.transactionId,
    reference: input.reference, requestedAmountMinor: input.requestedAmountMinor,
    settledAt: settlement.settlement_date,
  };
}
