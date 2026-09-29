# Phase 3C company purchase accounting boundary

Status: design and safety gate only. No live-company accounting capability is deployed or asserted by this document.

## Current behavior and the mismatch

- One company purchase pays for one course and **many employee seats** in one Paystack transaction. The purchase records its unit price, total, selected employees, and the successful payment attempt. Finalization grants each employee access.
- Learner commerce instead uses one `learning_orders` row per learner/course/charge. Its capture ledger, commercial allocation, earnings release, refund case, dispute case, and payout paths all key off that order.
- A company purchase currently creates no marketplace capture ledger, commission allocation, or instructor/provider earning. Creating one learner order for the *whole* company charge would misstate per-seat sales; creating ordinary learner orders without company provenance would expose a company-funded sale to personal learner views and make refund/payout handling ambiguous.

## Required model before a live company charge

1. Snapshot the selling entity, instructor/payee, commercial-terms version, course, NGN unit amount, seat list and total when the company manager prepares a purchase. Organization-owned courses must credit the provider organization under its own payout policy; a team member's personal-course earnings must not appear in organization reports.
2. Record **one** Paystack capture for the full company purchase, keyed by provider domain, reference and transaction ID. Allocate its exact total to immutable per-seat sale lines (`unit amount × seat count = capture amount`). Never treat Paystack's charge amount plus fees as the course price.
3. Post balanced platform-share and seller-liability entries from the seat lines. The company owner/admin sees its own invoice and seats; the selling instructor or provider sees only its own attributed sales. Company staff must not see Growvelt's commission or an instructor's unrelated earnings.
4. Make webhook and callback reconciliation idempotent. Replaying the same verified charge must create neither extra seats nor extra accounting lines. A mismatched amount, currency, domain, reference or transaction ID must stop fulfillment and raise an operator review.
5. Keep company-origin earnings on hold until the charge's refund/dispute window and company reversal policy are implemented. Existing learner payout functions must not reserve or transfer a company earning merely because a learner-style hold date elapsed.
6. Model Paystack's **partial refund on one transaction** as a company purchase adjustment tied to affected seat lines, with proportional seller/platform reversals and the correct employee access consequence. A full refund or lost dispute must reverse the entire sale exactly once. A pending refund is not a completed reversal. See [Paystack refund documentation](https://paystack.com/docs/payments/refunds/) and [dispute documentation](https://paystack.com/docs/payments/manage-disputes/).
7. Only after capture, allocation, reversal, privacy, payout-hold, reconciliation and recovery tests pass may a service-only database capability return `true` from `is_learning_company_live_accounting_ready`. The checkout route fails closed when this function is absent, errors, or returns anything else. The environment switch remains a separate operator-controlled gate.

## Test cases required for the accounting migration

- One verified company transaction with three seats produces one capture, three immutable seat sale lines and an exactly balanced split. Replaying webhook and callback leaves all counts and balances unchanged.
- Mismatched domain, reference, transaction ID, NGN amount, seat count or course terms cannot post a sale or grant additional access.
- Personal instructor, organization owner, organization team member, company manager, employee and admin queries each reveal only their permitted financial data.
- Refund one seat, refund all seats, lost dispute, duplicate refund/dispute events and refund after an earning becomes available/paid each preserve a balanced ledger and correct access. Release and payout are blocked while an unresolved company case exists.
- Existing learner orders and the confirmed company **Test Mode** purchase remain readable and unchanged. Historical company Test purchases require an explicit reviewed accounting backfill or an auditable exclusion; do not silently apply today's commercial terms to yesterday's sale.

## Deployment dependency

The pending payment-domain migration must be applied and checked first. Build and test the accounting migration against an isolated database before production. The earlier linked-DB connection timeout and unrecorded checkout-status migration must be reconciled; do not bypass that history with an improvised Dashboard SQL edit.
