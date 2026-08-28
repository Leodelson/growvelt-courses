# Phase 1B2A full-refund foundation

Phase 1B2A is test-mode infrastructure for administrator-controlled **full**
refunds. It does not define Growvelt's customer refund policy. Partial refunds,
disputes, chargebacks, provider allocation, earnings, payouts, and live Paystack
remain out of scope.

`PAYMENTS_REFUNDS_ENABLED` defaults to disabled and must remain `false` until a
separately approved controlled test. Checkout remains independently controlled
by `PAYMENTS_CHECKOUT_ENABLED`.

## Lifecycle and authority

The normalized local lifecycle is `requested -> submitting -> pending`, with
provider-driven transitions through `processing` or `needs_attention` and a
terminal economic state of `processed`. Legitimate `failed` and `cancelled`
states do not create a reversal.

The browser submits only an exact Growvelt order-reference confirmation, a
reason category, and an operator note. The server and database derive the
learner, course, currency, provider transaction, and complete refundable amount
from the authoritative paid order. Browser roles cannot execute refund database
functions.

## Provider processing and recovery

- Paystack initiation uses the server-only test secret.
- An accepted/queued provider response records submission state but never
  finalizes economics.
- A raw-body HMAC-verified refund webhook is durably recorded before processing.
- Administrator recovery verifies the refund through Paystack's API and records
  `provider_api` provenance, never `webhook` provenance.
- Only provider status `processed` invokes atomic finalization.
- Replayed webhooks and recovery events converge through the same idempotent
  processor and exactly-one ledger constraint.

## Economic and learning treatment

The original capture is immutable. A processed refund appends one balanced
`refund` ledger transaction with two compensating entries. It marks the paid
order refunded, marks its entitlement refunded with a revocation timestamp and
reason, and cancels the existing enrollment row. Lesson progress, quiz attempts
and answers, completion history, certificates, provider events, case events,
audit records, and original ledger rows are retained.

Certificate revocation and customer eligibility rules are intentionally not
encoded by this phase.

## Operator runbook

1. Keep refunds disabled unless a founder-approved test window is active.
2. Open `/dashboard/admin/payments` as an active administrator.
3. Review the paid order and reconciliation state.
4. Enter the exact Growvelt order reference, reason, and operator note.
5. Submit once. Do not interpret provider acceptance as completion.
6. If a case remains pending, use **Verify refund** once; the server checks
   Paystack and uses the same finalizer.
7. Confirm a processed case, one refund ledger transaction, two balanced
   entries, refunded entitlement, cancelled enrollment, and zero reconciliation
   findings.

Never edit the order, case, provider event, ledger, entitlement, or enrollment
manually.

## Controlled deployment boundary

The forward migration is additive except for replacing the existing payment-case
status checks with the expanded lifecycle and extending event-link validation.
It contains no table/column drop, truncation, data deletion, or rewrite of an
existing capture. Before any production deployment: validate on the isolated
local Supabase database, dry-run the single pending migration, keep the refund
flag false, verify Phase 1A/1B1 records unchanged, and obtain separate founder
approval.
