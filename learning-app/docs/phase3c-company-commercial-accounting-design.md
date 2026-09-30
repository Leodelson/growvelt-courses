# Phase 3C company purchase accounting boundary

Status: an isolated, un-deployed company capture/allocation migration is drafted. It does not create spendable instructor earnings or assert live-company accounting readiness. Migrations 43–44 passed a disposable PGlite PostgreSQL 18.3 test with a minimal dependency schema on 30 September 2026; this is **not** a full Supabase/PostgreSQL 17 deployment test.

## Current behavior and the mismatch

- One company purchase pays for one course and **many employee seats** in one Paystack transaction. The purchase records its unit price, total, selected employees, and the successful payment attempt. Finalization grants each employee access.
- Learner commerce instead uses one `learning_orders` row per learner/course/charge. Its capture ledger, commercial allocation, earnings release, refund case, dispute case, and payout paths all key off that order.
- A company purchase currently creates no marketplace capture ledger, commission allocation, or instructor/provider earning. Creating one learner order for the *whole* company charge would misstate per-seat sales; creating ordinary learner orders without company provenance would expose a company-funded sale to personal learner views and make refund/payout handling ambiguous.

## Required model before a live company charge

1. Snapshot the selling entity, instructor/payee, commercial-terms version, course, NGN unit amount, seat list and total when the company manager prepares a purchase. For an organization-owned course, the organization owner is the provisional payee snapshot; team members' personal-course earnings must not appear in organization reports. Confirm the provider payout policy before release.
2. Record **one** Paystack capture for the full company purchase, keyed by provider domain, reference and transaction ID. Allocate its exact total to immutable per-seat sale lines (`unit amount × seat count = capture amount`). Never treat Paystack's charge amount plus fees as the course price.
3. Post balanced platform-share and seller-liability entries from the seat lines. The company owner/admin sees its own invoice and seats; the selling instructor or provider sees only its own attributed sales. Company staff must not see Growvelt's commission or an instructor's unrelated earnings.
4. Make webhook and callback reconciliation idempotent. Replaying the same verified charge must create neither extra seats nor extra accounting lines. A mismatched amount, currency, domain, reference or transaction ID must stop fulfillment and raise an operator review.
5. Keep company-origin earnings on hold until the charge's refund/dispute window and company reversal policy are implemented. Existing learner payout functions must not reserve or transfer a company earning merely because a learner-style hold date elapsed.
6. Model Paystack's **partial refund on one transaction** as a company purchase adjustment tied to affected seat lines, with proportional seller/platform reversals and the correct employee access consequence. A full refund or lost dispute must reverse the entire sale exactly once. A pending refund is not a completed reversal. See [Paystack refund documentation](https://paystack.com/docs/payments/refunds/) and [dispute documentation](https://paystack.com/docs/payments/manage-disputes/).
7. Only after capture, allocation, reversal, privacy, payout-hold, reconciliation and recovery tests pass may a service-only database capability return `true` from `is_learning_company_live_accounting_ready`. The checkout route fails closed when this function is absent, errors, or returns anything else. The environment switch remains a separate operator-controlled gate.

The draft `20260944000000` migration covers items 1–3 at the **held-liability** stage and an idempotent posting/reconciliation path. It does not expose company proceeds through the existing personal-earnings or payout functions. It intentionally leaves historical Test purchases with no terms snapshot unallocated and reportable for manual review. Items 5–7, including company refunds/disputes and controlled earnings release, remain open.

The reusable isolated check is `scripts/test-phase3c-company-ledger-local.cjs`. It requires `@electric-sql/pglite` as a local test-only package (or `PGLITE_PACKAGE_PATH` pointing to an extracted copy). It reads the migrations from this project's deployable `supabase/migrations` directory. It verifies two seat lines, exact rounding, balanced capture/allocation ledgers, idempotence, append-only records, historical-purchase detection, and amount/domain rejection. It never connects to Supabase.

## Test cases required for the accounting migration

- One verified company transaction with three seats produces one capture, three immutable seat sale lines and an exactly balanced split. Replaying webhook and callback leaves all counts and balances unchanged.
- Mismatched domain, reference, transaction ID, NGN amount, seat count or course terms cannot post a sale or grant additional access.
- Personal instructor, organization owner, organization team member, company manager, employee and admin queries each reveal only their permitted financial data.
- Refund one seat, refund all seats, lost dispute, duplicate refund/dispute events and refund after an earning becomes available/paid each preserve a balanced ledger and correct access. Release and payout are blocked while an unresolved company case exists.
- Existing learner orders and the confirmed company **Test Mode** purchase remain readable and unchanged. Historical company Test purchases require an explicit reviewed accounting backfill or an auditable exclusion; do not silently apply today's commercial terms to yesterday's sale.

## Deployment dependency

The pending payment-domain migration must be applied and checked first. Build and test the accounting migration against an isolated database before production. A read-only linked-project check on 30 September 2026 found migrations 38–41 recorded remotely and migrations 42–44 pending in the CLI history. A schema-only export showed the two migration-42 function bodies present remotely despite its missing history entry. Exact, hash-verified copies of migrations 38–44 were placed in this project's `supabase/migrations` directory, which is the directory used by `supabase migration list --linked`; keep the root copies in sync while older local tests still read them. Do not run `db push` until the migration-42 history discrepancy is reviewed, migration 43–44 are validated against a full PostgreSQL 17/Supabase schema, and company reversal/payout safeguards are complete. The schema-only export was deleted after comparison.
