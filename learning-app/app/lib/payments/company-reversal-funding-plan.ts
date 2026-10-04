// A calculation-only model for a future verified company reversal workflow.
// It neither posts ledger entries nor deducts from any seller balance.
export type SellerFundingSnapshot = {
  heldMinor: number;
  availableMinor: number;
  reservedMinor: number;
  transferredMinor: number;
  priorRecoveryMinor: number;
};

export type ReversalFundingPlan =
  | { state: "manual_review"; reason: "reserved_funds" | "mixed_or_insufficient_funds" | "invalid_amounts" }
  | { state: "journal_candidate"; sellerAccount: string; entries: { account: string; amountMinor: number }[] };

const valid = (value: number) => Number.isSafeInteger(value) && value >= 0;

export function planCompanyReversalFunding(
  grossMinor: number,
  platformMinor: number,
  sellerMinor: number,
  funding: SellerFundingSnapshot,
): ReversalFundingPlan {
  if (![grossMinor, platformMinor, sellerMinor].every(valid)
      || grossMinor <= 0 || grossMinor !== platformMinor + sellerMinor
      || Object.values(funding).some((value) => !valid(value))
      || funding.priorRecoveryMinor > funding.transferredMinor) {
    return { state: "manual_review", reason: "invalid_amounts" };
  }
  if (funding.reservedMinor > 0) return { state: "manual_review", reason: "reserved_funds" };

  // Never silently split one employee's seller share across liabilities or
  // a paid-seller receivable. Such cases require an explicit admin allocation.
  const sellerAccount = sellerMinor === 0 ? "none"
    : funding.heldMinor >= sellerMinor && funding.availableMinor === 0 && funding.transferredMinor === 0
      ? "liability.company_seller_earnings_held"
    : funding.availableMinor >= sellerMinor && funding.heldMinor === 0 && funding.transferredMinor === 0
      ? "liability.company_seller_earnings_available"
    : funding.transferredMinor - funding.priorRecoveryMinor >= sellerMinor
        && funding.heldMinor === 0 && funding.availableMinor === 0
      ? "asset.company_seller_recovery_receivable"
    : null;
  if (sellerAccount === null) return { state: "manual_review", reason: "mixed_or_insufficient_funds" };

  const entries = [
    { account: "revenue.platform_commission", amountMinor: platformMinor },
    ...(sellerMinor > 0 ? [{ account: sellerAccount, amountMinor: sellerMinor }] : []),
    { account: "asset.paystack_receivable", amountMinor: -grossMinor },
  ].filter((entry) => entry.amountMinor !== 0);
  if (entries.reduce((sum, entry) => sum + entry.amountMinor, 0) !== 0) {
    return { state: "manual_review", reason: "invalid_amounts" };
  }
  return { state: "journal_candidate", sellerAccount, entries };
}
