import assert from "node:assert/strict";
import { calculateCoupon } from "../app/lib/promotions/coupon-calculator.ts";

const base = {
  coupon: {
    active: true,
    courseIds: [11],
    startsAt: "2026-10-01T00:00:00.000Z",
    endsAt: "2026-11-01T00:00:00.000Z",
    discountKind: "fixed",
    discountValue: 500,
    maxDiscountMinor: 500,
    minimumChargeMinor: 100,
    maxRedemptions: 10,
    maxRedemptionsPerUser: 1,
  },
  courseId: 11,
  now: "2026-10-07T12:00:00.000Z",
  listPriceMinor: 5_000,
  platformShareMinor: 1_000,
  sellerShareMinor: 4_000,
  redemptionCount: 0,
  userRedemptionCount: 0,
};

const fixed = calculateCoupon(base);
assert.deepEqual(fixed, {
  ok: true,
  listPriceMinor: 5_000,
  discountMinor: 500,
  customerChargeMinor: 4_500,
  sellerShareMinor: 4_000,
  platformShareMinor: 500,
});
assert.equal(fixed.ok && fixed.customerChargeMinor,
  fixed.ok ? fixed.sellerShareMinor + fixed.platformShareMinor : -1);

const percentage = calculateCoupon({
  ...base,
  coupon: { ...base.coupon, discountKind: "percentage", discountValue: 1_250, maxDiscountMinor: 2_000 },
  listPriceMinor: 1_001,
  platformShareMinor: 300,
  sellerShareMinor: 701,
});
assert.deepEqual(percentage, {
  ok: true,
  listPriceMinor: 1_001,
  discountMinor: 125,
  customerChargeMinor: 876,
  sellerShareMinor: 701,
  platformShareMinor: 175,
});

const capped = calculateCoupon({
  ...base,
  coupon: { ...base.coupon, discountKind: "percentage", discountValue: 5_000, maxDiscountMinor: 200 },
});
assert.equal(capped.ok && capped.discountMinor, 200);

const rejected = [
  [{ ...base, coupon: { ...base.coupon, active: false } }, "inactive"],
  [{ ...base, now: "2026-09-30T23:59:59.999Z" }, "not_started"],
  [{ ...base, now: "2026-11-01T00:00:00.000Z" }, "expired"],
  [{ ...base, courseId: 12 }, "ineligible_course"],
  [{ ...base, coupon: { ...base.coupon, courseIds: [] } }, "invalid_coupon"],
  [{ ...base, redemptionCount: 10 }, "redemption_limit"],
  [{ ...base, userRedemptionCount: 1 }, "user_redemption_limit"],
  [{ ...base, platformShareMinor: 100, sellerShareMinor: 4_900 }, "platform_share_insufficient"],
  [{ ...base, coupon: { ...base.coupon, discountValue: 4_950, maxDiscountMinor: 4_950, minimumChargeMinor: 100 }, platformShareMinor: 4_950, sellerShareMinor: 50 }, "minimum_charge_unmet"],
  [{ ...base, platformShareMinor: 900, sellerShareMinor: 4_000 }, "invalid_commercial_split"],
  [{ ...base, platformShareMinor: 5_000, sellerShareMinor: 0 }, "invalid_commercial_split"],
  [{ ...base, platformShareMinor: Number.NaN }, "invalid_commercial_split"],
  [{ ...base, coupon: { ...base.coupon, discountKind: "percentage", discountValue: 10_001 } }, "invalid_coupon"],
];

for (const [input, reason] of rejected) {
  assert.deepEqual(calculateCoupon(input), { ok: false, reason });
}

console.log("PASS Phase 4 coupon arithmetic, eligibility limits, seller-share preservation, and fail-closed cases");
