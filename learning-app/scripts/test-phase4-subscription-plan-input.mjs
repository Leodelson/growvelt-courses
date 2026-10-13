import assert from "node:assert/strict";
import { parseNgNPriceToMinorUnits, parseSelectedSubscriptionCourseIds } from "../app/lib/subscriptions/plan-input.ts";

assert.equal(parseNgNPriceToMinorUnits("15000"), 1_500_000);
assert.equal(parseNgNPriceToMinorUnits("15000.5"), 1_500_050);
assert.equal(parseNgNPriceToMinorUnits("0.01"), 1);
for (const price of ["", "0", "-1", "1.001", "1e3", "NaN", "90071992547409.92"]) {
  assert.equal(parseNgNPriceToMinorUnits(price), null, `reject malformed or unsafe price ${price}`);
}

assert.deepEqual(parseSelectedSubscriptionCourseIds(["12", "345"]), [12, 345]);
for (const courseIds of [[], ["0"], ["-1"], ["1e3"], ["9007199254740992"], ["1", "1"], Array.from({ length: 51 }, (_, index) => String(index + 1))]) {
  assert.equal(parseSelectedSubscriptionCourseIds(courseIds), null, `reject invalid course selection ${courseIds.join(",")}`);
}

console.log("PASS subscription-plan price parsing and course-selection bounds");
