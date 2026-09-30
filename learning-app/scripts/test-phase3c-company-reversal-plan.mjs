import assert from "node:assert/strict";
import { planCompanySeatReversal } from "../app/lib/payments/company-reversal-plan.ts";

const sale = {
  purchaseId: 17,
  paystackDomain: "test",
  providerReference: `CP-${"A".repeat(32)}`,
  currency: "NGN",
  grossAmountMinor: 20000,
  seats: [
    { assignedUserId: "employee-a", unitAmountMinor: 10000, platformCommissionMinor: 2000, sellerGrossMinor: 8000, accessStatus: "active" },
    { assignedUserId: "employee-b", unitAmountMinor: 10000, platformCommissionMinor: 2000, sellerGrossMinor: 8000, accessStatus: "active" },
  ],
};
const refund = { kind: "processed_refund", paystackDomain: "test", providerReference: sale.providerReference, currency: "NGN", amountMinor: 10000 };
const dispute = { ...refund, kind: "lost_dispute", amountMinor: 20000 };
assert.deepEqual(planCompanySeatReversal(sale, refund, ["employee-b"]), {
  purchaseId: 17, kind: "processed_refund", assignedUserIds: ["employee-b"],
  grossAmountMinor: 10000, platformCommissionMinor: 2000, sellerGrossMinor: 8000,
});
assert.equal(planCompanySeatReversal(sale, refund, ["employee-a", "employee-b"]), null);
assert.equal(planCompanySeatReversal(sale, { ...refund, amountMinor: 5000 }, ["employee-a"]), null);
assert.equal(planCompanySeatReversal(sale, { ...refund, paystackDomain: "live" }, ["employee-a"]), null);
assert.equal(planCompanySeatReversal(sale, { ...refund, kind: "pending_refund" }, ["employee-a"]), null);
assert.equal(planCompanySeatReversal(sale, { ...refund, currency: "USD" }, ["employee-a"]), null);
assert.equal(planCompanySeatReversal(sale, { ...refund, providerReference: "wrong" }, ["employee-a"]), null);
assert.equal(planCompanySeatReversal(sale, refund, ["employee-a", "employee-a"]), null);
assert.equal(planCompanySeatReversal(sale, refund, ["unknown"]), null);
assert.equal(planCompanySeatReversal({ ...sale, seats: [{ ...sale.seats[0], accessStatus: null }, sale.seats[1]] }, refund, ["employee-a"]), null);
assert.equal(planCompanySeatReversal({ ...sale, seats: [{ ...sale.seats[0], accessStatus: "refunded" }, sale.seats[1]] }, refund, ["employee-a"]), null);
assert.equal(planCompanySeatReversal({ ...sale, grossAmountMinor: 19999 }, refund, ["employee-a"]), null);
assert.equal(planCompanySeatReversal({ ...sale, seats: [{ ...sale.seats[0], sellerGrossMinor: 7999 }, sale.seats[1]] }, refund, ["employee-a"]), null);
assert.equal(planCompanySeatReversal(sale, dispute, ["employee-a"]), null);
assert.deepEqual(planCompanySeatReversal(sale, dispute, ["employee-b", "employee-a"])?.assignedUserIds, ["employee-a", "employee-b"]);
console.log("PASS company reversal planning rejects ambiguous, mismatched, unproven, and duplicate seats");
