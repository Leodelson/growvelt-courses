import assert from "node:assert/strict";
import { hasPaidSubscriptionCourseAccess } from "../app/lib/subscriptions/subscription-access.ts";

const base = {
  courseIncludedInPaidPeriod: true,
  paidPeriodStartsAt: "2026-10-01T00:00:00.000Z",
  paidThrough: "2026-11-01T00:00:00.000Z",
  renewalState: "active",
  accessRevoked: false,
  now: "2026-10-12T12:00:00.000Z",
};

assert.equal(hasPaidSubscriptionCourseAccess(base), true);
assert.equal(hasPaidSubscriptionCourseAccess({ ...base, renewalState: "non_renewing" }), true);
assert.equal(hasPaidSubscriptionCourseAccess({ ...base, renewalState: "attention" }), true);
assert.equal(hasPaidSubscriptionCourseAccess({ ...base, renewalState: "cancelled" }), true);
assert.equal(hasPaidSubscriptionCourseAccess({ ...base, renewalState: "completed" }), true);

const denied = [
  { ...base, courseIncludedInPaidPeriod: false },
  { ...base, accessRevoked: true },
  { ...base, renewalState: "expired" },
  { ...base, now: "2026-09-30T23:59:59.999Z" },
  { ...base, now: "2026-11-01T00:00:00.000Z" },
  { ...base, paidPeriodStartsAt: null },
  { ...base, paidThrough: "not-a-date" },
  { ...base, paidThrough: "2026-10-01T00:00:00.000Z" },
  { ...base, now: "not-a-date" },
];

for (const input of denied) assert.equal(hasPaidSubscriptionCourseAccess(input), false);

console.log("PASS Phase 4 paid-period access boundaries, cancellation, failed renewal, and fail-closed dates");
