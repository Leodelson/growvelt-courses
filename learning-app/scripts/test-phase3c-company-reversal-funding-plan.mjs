import assert from "node:assert/strict";
import { planCompanyReversalFunding } from "../app/lib/payments/company-reversal-funding-plan.ts";

const base = { heldMinor: 0, availableMinor: 0, reservedMinor: 0,
  transferredMinor: 0, priorRecoveryMinor: 0 };
const held = planCompanyReversalFunding(101, 25, 76, { ...base, heldMinor: 76 });
assert.equal(held.state, "journal_candidate");
assert.equal(held.sellerAccount, "liability.company_seller_earnings_held");
assert.equal(held.entries.reduce((sum, entry) => sum + entry.amountMinor, 0), 0);

const available = planCompanyReversalFunding(101, 25, 76, { ...base, availableMinor: 76 });
assert.equal(available.state, "journal_candidate");
assert.equal(available.sellerAccount, "liability.company_seller_earnings_available");

const paid = planCompanyReversalFunding(101, 25, 76, { ...base, transferredMinor: 152,
  priorRecoveryMinor: 76 });
assert.equal(paid.state, "journal_candidate");
assert.equal(paid.sellerAccount, "asset.company_seller_recovery_receivable");
assert.deepEqual(paid.entries, [
  { account: "revenue.platform_commission", amountMinor: 25 },
  { account: "asset.company_seller_recovery_receivable", amountMinor: 76 },
  { account: "asset.paystack_receivable", amountMinor: -101 },
]);

assert.deepEqual(planCompanyReversalFunding(101, 25, 76,
  { ...base, reservedMinor: 76 }), { state: "manual_review", reason: "reserved_funds" });
assert.deepEqual(planCompanyReversalFunding(101, 25, 76,
  { ...base, heldMinor: 40, transferredMinor: 36 }),
{ state: "manual_review", reason: "mixed_or_insufficient_funds" });
assert.deepEqual(planCompanyReversalFunding(101, 25, 76,
  { ...base, transferredMinor: 76, priorRecoveryMinor: 76 }),
{ state: "manual_review", reason: "mixed_or_insufficient_funds" });
assert.deepEqual(planCompanyReversalFunding(101, 25, 75,
  { ...base, heldMinor: 76 }), { state: "manual_review", reason: "invalid_amounts" });
assert.deepEqual(planCompanyReversalFunding(101, 25, 76,
  { ...base, transferredMinor: 76, priorRecoveryMinor: 77 }),
{ state: "manual_review", reason: "invalid_amounts" });
console.log("PASS company reversal funding model balances held, available and paid-seller candidates; reserved and mixed cases stay manual");
