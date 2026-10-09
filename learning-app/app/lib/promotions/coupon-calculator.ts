export type CouponDiscountKind = "fixed" | "percentage";

export type CouponTerms = {
  active: boolean;
  courseIds: readonly number[];
  startsAt: string;
  endsAt: string;
  discountKind: CouponDiscountKind;
  /** Fixed amount in minor units, or percentage in basis points (10_000 = 100%). */
  discountValue: number;
  maxDiscountMinor: number;
  minimumChargeMinor: number;
  maxRedemptions: number | null;
  maxRedemptionsPerUser: number | null;
};

export type CouponCalculationInput = {
  coupon: CouponTerms;
  courseId: number;
  now: string;
  listPriceMinor: number;
  platformShareMinor: number;
  sellerShareMinor: number;
  redemptionCount: number;
  userRedemptionCount: number;
};

export type CouponCalculation =
  | {
      ok: true;
      listPriceMinor: number;
      discountMinor: number;
      customerChargeMinor: number;
      sellerShareMinor: number;
      platformShareMinor: number;
    }
  | {
      ok: false;
      reason:
        | "invalid_coupon"
        | "inactive"
        | "not_started"
        | "expired"
        | "ineligible_course"
        | "redemption_limit"
        | "user_redemption_limit"
        | "invalid_price"
        | "invalid_commercial_split"
        | "platform_share_insufficient"
        | "minimum_charge_unmet";
    };

const isPositiveSafeInteger = (value: number) => Number.isSafeInteger(value) && value > 0;
const isNonNegativeSafeInteger = (value: number) => Number.isSafeInteger(value) && value >= 0;

function validLimit(limit: number | null): boolean {
  return limit === null || isPositiveSafeInteger(limit);
}

function wholeMinorUnits(value: bigint): number | null {
  if (value < BigInt(0) || value > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(value);
}

/**
 * Pure preflight calculator for the first Phase 4 coupon slice.
 * Database-backed code must repeat eligibility/capacity checks atomically.
 */
export function calculateCoupon(input: CouponCalculationInput): CouponCalculation {
  const { coupon } = input;
  const start = Date.parse(coupon.startsAt);
  const end = Date.parse(coupon.endsAt);
  const now = Date.parse(input.now);

  if (!coupon || !["fixed", "percentage"].includes(coupon.discountKind)
    || !Array.isArray(coupon.courseIds) || coupon.courseIds.length === 0
    || coupon.courseIds.some((id) => !isPositiveSafeInteger(id))
    || !Number.isFinite(start) || !Number.isFinite(end) || start >= end || !Number.isFinite(now)
    || !isPositiveSafeInteger(coupon.discountValue)
    || (coupon.discountKind === "percentage" && coupon.discountValue > 10_000)
    || !isPositiveSafeInteger(coupon.maxDiscountMinor)
    || !isPositiveSafeInteger(coupon.minimumChargeMinor)
    || !validLimit(coupon.maxRedemptions) || !validLimit(coupon.maxRedemptionsPerUser)
    || !isNonNegativeSafeInteger(input.redemptionCount)
    || !isNonNegativeSafeInteger(input.userRedemptionCount)) {
    return { ok: false, reason: "invalid_coupon" };
  }

  if (!coupon.active) return { ok: false, reason: "inactive" };
  if (now < start) return { ok: false, reason: "not_started" };
  if (now >= end) return { ok: false, reason: "expired" };
  if (!isPositiveSafeInteger(input.courseId) || !coupon.courseIds.includes(input.courseId)) {
    return { ok: false, reason: "ineligible_course" };
  }
  if (coupon.maxRedemptions !== null && input.redemptionCount >= coupon.maxRedemptions) {
    return { ok: false, reason: "redemption_limit" };
  }
  if (coupon.maxRedemptionsPerUser !== null && input.userRedemptionCount >= coupon.maxRedemptionsPerUser) {
    return { ok: false, reason: "user_redemption_limit" };
  }
  if (!isPositiveSafeInteger(input.listPriceMinor)) return { ok: false, reason: "invalid_price" };
  if (!isNonNegativeSafeInteger(input.platformShareMinor)
    || !isPositiveSafeInteger(input.sellerShareMinor)) {
    return { ok: false, reason: "invalid_commercial_split" };
  }

  const listPrice = BigInt(input.listPriceMinor);
  const platformShare = BigInt(input.platformShareMinor);
  const sellerShare = BigInt(input.sellerShareMinor);
  if (platformShare + sellerShare !== listPrice) {
    return { ok: false, reason: "invalid_commercial_split" };
  }

  const rawDiscount = coupon.discountKind === "fixed"
    ? BigInt(coupon.discountValue)
    : (listPrice * BigInt(coupon.discountValue) + BigInt(5_000)) / BigInt(10_000);
  const discount = rawDiscount < BigInt(coupon.maxDiscountMinor)
    ? rawDiscount
    : BigInt(coupon.maxDiscountMinor);
  if (discount <= BigInt(0)) return { ok: false, reason: "invalid_coupon" };
  if (discount > platformShare) return { ok: false, reason: "platform_share_insufficient" };

  const customerCharge = listPrice - discount;
  if (customerCharge < BigInt(coupon.minimumChargeMinor)) {
    return { ok: false, reason: "minimum_charge_unmet" };
  }

  const chargeMinor = wholeMinorUnits(customerCharge);
  const remainingPlatformShare = wholeMinorUnits(platformShare - discount);
  const preservedSellerShare = wholeMinorUnits(sellerShare);
  if (chargeMinor === null || remainingPlatformShare === null || preservedSellerShare === null
    || remainingPlatformShare + preservedSellerShare !== chargeMinor) {
    return { ok: false, reason: "invalid_commercial_split" };
  }

  return {
    ok: true,
    listPriceMinor: input.listPriceMinor,
    discountMinor: Number(discount),
    customerChargeMinor: chargeMinor,
    sellerShareMinor: preservedSellerShare,
    platformShareMinor: remainingPlatformShare,
  };
}
