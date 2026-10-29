export class PaystackRefundFundingError extends Error {
  constructor() {
    super("Paystack rejected the refund because available funds are insufficient.");
    this.name = "PaystackRefundFundingError";
  }
}

export function throwIfRefundFundingRejected(result: { status?: unknown; message?: unknown; data?: unknown } | null) {
  if ((result?.status !== false && result?.status !== "false") || result.data || typeof result.message !== "string") return;
  if (/^insufficient balance to (?:process|fulfil|fulfill) (?:this |the )?refund(?:\. please top up\.?)?$/i.test(result.message.trim())) {
    throw new PaystackRefundFundingError();
  }
}
