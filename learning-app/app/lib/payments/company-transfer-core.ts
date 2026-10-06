// Read-only Paystack evidence for a future company seller transfer.
// This validates a transfer against an already-approved reservation; it does
// not initiate transfers or write company accounting records.
type ProviderTransfer = Record<string, unknown>;

export type CompanyLiveTransferLookup = {
  reference: string;
  recipientCode: string;
  amountMinor: number;
};

export type CompanyLiveTransferEvidence = {
  transferId: string;
  transferCode: string | null;
  reference: string;
  recipientCode: string;
  amountMinor: number;
  currency: "NGN";
  domain: "live";
  status: "succeeded";
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

export async function verifyCompanyLiveTransferEvidence(
  input: CompanyLiveTransferLookup,
  readTransfer: (reference: string) => Promise<unknown>,
): Promise<CompanyLiveTransferEvidence> {
  if (!/^lcs-[a-z0-9_-]{12,46}$/.test(input.reference)
      || !/^RCP_[A-Za-z0-9]+$/.test(input.recipientCode)
      || positiveMinor(input.amountMinor) === null) {
    throw new Error("Invalid company seller transfer lookup.");
  }

  const envelope = await readTransfer(input.reference) as { status?: unknown; data?: unknown } | null;
  const transfer = envelope?.data && typeof envelope.data === "object" && !Array.isArray(envelope.data)
    ? envelope.data as ProviderTransfer : null;
  const recipient = transfer?.recipient && typeof transfer.recipient === "object" && !Array.isArray(transfer.recipient)
    ? transfer.recipient as ProviderTransfer : null;
  const transferId = numericId(transfer?.id);
  const amountMinor = positiveMinor(transfer?.amount);
  const transferCode = typeof transfer?.transfer_code === "string" ? transfer.transfer_code : null;

  if (envelope?.status !== true || !transfer || !recipient || !transferId
      || transfer.reference !== input.reference || amountMinor !== input.amountMinor
      || transfer.currency !== "NGN" || transfer.domain !== "live"
      || transfer.status !== "success" || transfer.source !== "balance"
      || recipient.recipient_code !== input.recipientCode
      || recipient.currency !== "NGN" || recipient.domain !== "live"
      || (transferCode !== null && !/^TRF_[A-Za-z0-9]+$/.test(transferCode))) {
    throw new Error("Paystack company seller transfer verification was inconclusive.");
  }

  return {
    transferId,
    transferCode,
    reference: input.reference,
    recipientCode: input.recipientCode,
    amountMinor,
    currency: "NGN",
    domain: "live",
    status: "succeeded",
  };
}
