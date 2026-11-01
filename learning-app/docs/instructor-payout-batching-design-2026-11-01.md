# Instructor payout batching — implementation boundary

**Status:** approved policy direction; design under review. The first read-only eligibility migration has been drafted and tested locally, but has not been applied to production. No Live transfer has been initiated by this workstream.

## Policy

- The proposed ordinary Live payout minimum is NGN 1,000 in eligible instructor earnings. Smaller eligible amounts carry forward; they are not forfeited or shown as paid.
- Held, refunded, disputed, reversed, recoverable, already reserved, and already paid earnings do not count toward a new payout.
- The provider's NGN 50 minimum is a separate technical floor. Fees are funded by Growvelt and must be checked against the available transfer balance before initiation. Do not silently deduct a transfer fee from an instructor's recorded share.
- A low-balance account-closure exception requires an operator-reviewed policy and accounting treatment before it is offered. It must never be an automatic bypass of provider limits or financial-protection checks.
- No public withdrawal promise or automatic schedule is effective until the corresponding writer, reconciliation, and operations are validated and enabled.

## Verified existing constraints

The current `learning_instructor_earning_reservations` table has one unique `earning_id` per reservation. `learning_instructor_payout_items` has unique `reservation_id` and `earning_id`, and its amount is immutable. The Live approval, submission, and payout-event processor each validate one payout item against one reservation, earning, allocation, and order. A payout settlement has a unique payout-item, earning, and reservation identity and posts a two-line ledger transaction for one earning. A single application-level sum cannot safely turn these records into a batch.

## Safe implementation slices

1. Add an administrator-only, read-only eligible-balance projection grouped by instructor and currency. Return a bounded list of underlying earning IDs and their statuses for review; never treat a displayed sum as permission to transfer.
2. Introduce a new batch identity and immutable batch-member mapping. Preserve every existing single-earning payout item and settlement. Constrain each earning/reservation to at most one active batch or existing payout item. Do not rewrite historical identities.
3. In one database transaction, lock the instructor, candidate earnings, allocations, orders, payment cases, and payout destination in a consistent order. Revalidate every member, calculate the amount using integer minor units, enforce the NGN 1,000 ordinary threshold, and atomically reserve/link the exact members. Use a stable idempotency key and record actor, recipient identity, amount, and member IDs in an append-only audit trail.
4. Keep approval separate from Live submission. Immediately before a provider request, recheck all members, active financial cases, destination, amount, and available transfer balance plus fee. A provider timeout must freeze the batch for reference-based verification; never start a second transfer blindly. OTP is one-use and not retained.
5. On an authoritative success, settle each member exactly once with balanced ledger entries and a batch-level provider identity. On a failed transfer, release only financially eligible members; keep reversed or disputed members blocked. On late refunds or transfer reversals, record findings and recovery liabilities without rewriting prior settlements. Reconcile duplicate, delayed, contradictory, and out-of-order provider events.
6. Show held, available-but-below-minimum, eligible-for-review, reserved, pending, paid, and reversed amounts distinctly. Add payout FAQ wording only when the policy is operational. Verify mobile layout and accessible status text.

## Required validation before deployment

The first slice is `20261121000000_list_instructor_live_payout_batch_eligibility.sql`. It returns aggregate amounts and counts only; it deliberately does **not** return earning IDs or offer an approval action. The isolated PGlite fixture tests active and processed financial cases, Test-domain payments, held earnings, reversed allocations, prior reservations, below-threshold balances, active Live profiles, and administrator-only execution. A separately authorized detail view and authoritative database recheck are still required before any writer.

The second slice is `20261122000000_add_instructor_live_payout_batch_identity.sql`. It creates inert, immutable batch and member identities. At transaction commit, a batch must contain members whose exact sum equals its amount; member insertions check the reservation, earning, and active Live profile. Reciprocal triggers prevent an earning or reservation from entering both a batch and the existing single-item payout path. Direct service-role writes are not granted. The local PGlite test covers amount equality, immutable history, overlap in both directions, and table permissions. This slice has not been applied to production and still has no approval, transfer, or settlement writer.

- Fixture tests: two small eligible sales crossing the threshold; a single small sale below it; held and refunded sales excluded; duplicate approval/submit/webhook; concurrent approvals; changed recipient; active dispute at approval and immediately before transfer; provider timeout; OTP and no-OTP flows; success, failure, reversal, delayed success, and partial financial protection.
- Database invariants: no earning belongs to two payouts; batch amount equals exact member sum; every successful member has one settlement and balanced ledger movement; failed batches cannot lose or duplicate liability; existing one-item records remain readable and reconcilable.
- Application tests: admin-only access, explicit amount/recipient confirmation, no instructor withdrawal button until enabled, FAQ truthfulness, and clear provider-error recovery.
- Production gate: migration review and backup/rollback plan, hosted schema parity, provider balance and fee check, feature flags initially off, one founder-approved controlled transfer, provider verification, bank-credit confirmation, and post-transfer reconciliation. Company seller payouts remain a separate gate.

## Rollback principle

The new schema must be additive. If application rollout is reverted, disable batch approval/submission and preserve batch, provider, ledger, and event records for reconciliation. Never delete or reassign a submitted transfer to “roll back” money movement.
