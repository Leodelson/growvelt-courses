// Pure eligibility check. The caller must independently verify the provider's
// final outcome; this function never changes money, earnings, or course access.
export type CompanySaleSeat = {
  assignedUserId: string;
  unitAmountMinor: number;
  platformCommissionMinor: number;
  sellerGrossMinor: number;
  accessStatus: "active" | "refunded" | "chargeback" | null;
};

export type CompanySaleForReversal = {
  purchaseId: number;
  paystackDomain: "test" | "live";
  providerReference: string;
  currency: "NGN";
  grossAmountMinor: number;
  seats: CompanySaleSeat[];
};

export type CompanyReversalOutcome = {
  kind: "processed_refund" | "lost_dispute";
  paystackDomain: "test" | "live";
  providerReference: string;
  currency: "NGN";
  amountMinor: number;
};

export type CompanySeatReversalPlan = {
  purchaseId: number;
  kind: CompanyReversalOutcome["kind"];
  assignedUserIds: string[];
  grossAmountMinor: number;
  platformCommissionMinor: number;
  sellerGrossMinor: number;
};

function validMoney(value: number) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function planCompanySeatReversal(
  sale: CompanySaleForReversal,
  outcome: CompanyReversalOutcome,
  selectedUserIds: string[],
): CompanySeatReversalPlan | null {
  if (!Number.isSafeInteger(sale.purchaseId) || sale.purchaseId <= 0
      || !sale.providerReference || !sale.seats.length
      || !["test", "live"].includes(sale.paystackDomain)
      || !["processed_refund", "lost_dispute"].includes(outcome.kind)
      || sale.currency !== "NGN"
      || sale.paystackDomain !== outcome.paystackDomain
      || sale.providerReference !== outcome.providerReference
      || sale.currency !== outcome.currency
      || !validMoney(sale.grossAmountMinor) || sale.grossAmountMinor === 0
      || !validMoney(outcome.amountMinor) || outcome.amountMinor === 0
      || !selectedUserIds.length || new Set(selectedUserIds).size !== selectedUserIds.length) return null;

  const seatsByUser = new Map<string, CompanySaleSeat>();
  let saleGross = 0;
  for (const seat of sale.seats) {
    if (!seat.assignedUserId || seatsByUser.has(seat.assignedUserId)
        || !validMoney(seat.unitAmountMinor) || seat.unitAmountMinor === 0
        || !validMoney(seat.platformCommissionMinor) || !validMoney(seat.sellerGrossMinor)
        || seat.unitAmountMinor !== seat.platformCommissionMinor + seat.sellerGrossMinor) return null;
    seatsByUser.set(seat.assignedUserId, seat);
    saleGross += seat.unitAmountMinor;
    if (!Number.isSafeInteger(saleGross)) return null;
  }
  if (saleGross !== sale.grossAmountMinor) return null;

  // A lost dispute reverses the charge, not an arbitrary subset of employees.
  if (outcome.kind === "lost_dispute"
      && (outcome.amountMinor !== sale.grossAmountMinor || selectedUserIds.length !== sale.seats.length)) return null;

  let gross = 0;
  let platform = 0;
  let seller = 0;
  for (const id of selectedUserIds) {
    const seat = seatsByUser.get(id);
    // Missing provenance or an earlier reversal needs operator reconciliation.
    if (!seat || seat.accessStatus !== "active") return null;
    gross += seat.unitAmountMinor;
    platform += seat.platformCommissionMinor;
    seller += seat.sellerGrossMinor;
    if (![gross, platform, seller].every(Number.isSafeInteger)) return null;
  }
  if (gross !== outcome.amountMinor || gross !== platform + seller) return null;
  return {
    purchaseId: sale.purchaseId,
    kind: outcome.kind,
    assignedUserIds: [...selectedUserIds].sort(),
    grossAmountMinor: gross,
    platformCommissionMinor: platform,
    sellerGrossMinor: seller,
  };
}
