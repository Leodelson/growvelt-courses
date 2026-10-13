export type SubscriptionRenewalState =
  | "active"
  | "non_renewing"
  | "attention"
  | "cancelled"
  | "completed"
  | "expired";

export type PaidSubscriptionPeriodAccessInput = {
  /** Must come from an immutable, server-verified paid invoice snapshot. */
  courseIncludedInPaidPeriod: boolean;
  paidPeriodStartsAt: string | null;
  paidThrough: string | null;
  renewalState: SubscriptionRenewalState;
  accessRevoked: boolean;
  now: string;
};

/**
 * Resolves subscription access against the last confirmed paid period only.
 * Renewal state (including cancellation or a failed renewal) cannot shorten a
 * period the learner has already paid for, and never extends it either.
 * Callers must not populate the period from an unverified browser callback or
 * an unverified webhook payload.
 */
export function hasPaidSubscriptionCourseAccess(input: PaidSubscriptionPeriodAccessInput): boolean {
  if (!input.courseIncludedInPaidPeriod || input.accessRevoked) return false;

  const startsAt = Date.parse(input.paidPeriodStartsAt ?? "");
  const paidThrough = Date.parse(input.paidThrough ?? "");
  const now = Date.parse(input.now);

  if (!Number.isFinite(startsAt) || !Number.isFinite(paidThrough) || !Number.isFinite(now)) return false;
  if (paidThrough <= startsAt || now < startsAt || now >= paidThrough) return false;

  return ["active", "non_renewing", "attention", "cancelled", "completed"].includes(input.renewalState);
}
