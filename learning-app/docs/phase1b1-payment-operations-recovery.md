# Phase 1B1 payment operations and recovery

Phase 1B1 remains Paystack test-mode only. Production checkout stays behind
`PAYMENTS_CHECKOUT_ENABLED` and must remain `false` unless a separately approved
founder test temporarily enables it.

## Durable event flow

1. The webhook validates the raw-body Paystack HMAC and parses the narrowly
   supported test `charge.success` payload.
2. `receive_paystack_test_charge_event` commits the verified event to the
   provider-event inbox before business processing begins.
3. `process_paystack_test_charge_event` invokes the proven Phase 1A atomic
   finalizer and records processing attempts, retry timing, and recovery state.
4. A processing exception is logged without secrets. Because the verified event
   is already durable, an administrator can verify Paystack and reprocess it
   without fabricating financial or access records.

Duplicate event IDs with the same digest are idempotent. A different digest for
the same event ID is a conflict and is never guessed or overwritten.

## Provider verification recovery

The protected payment-operations page is available only inside the existing
administrator layout. The recovery endpoint:

- requires a same-origin authenticated request;
- rechecks the authoritative active administrator capability;
- calls Paystack transaction verification using the server-only test secret;
- records API verification separately from signed-webhook verification;
- invokes the same atomic finalizer used by webhook processing;
- records the operator and outcome in `learning_audit_events`.

A successful provider verification never trusts a browser-supplied amount,
learner, course, transaction ID, or status.

## Stale and abandoned checkout handling

Reconciliation flags a pending attempt after two hours. An attempt can be moved
to `abandoned` only after a service-side Paystack verification returns the
conclusive non-success status `abandoned` or `failed`, the attempt is at least
30 minutes old, and the operator still has active administrator authority.
Pending or ambiguous provider states leave local state unchanged.

## Reconciliation coverage

The service-only reconciliation RPC now reports:

- paid order without a succeeded attempt;
- paid order without a capture ledger;
- paid order without an active entitlement;
- entitlement without a corresponding active/completed enrollment;
- succeeded attempt attached to an unpaid order;
- failed provider events;
- verified events stuck in `received` for more than five minutes;
- pending attempts older than two hours;
- capture-ledger imbalance or too few lines;
- duplicate capture ledgers.

Reconciliation is read-only and never repairs records automatically.

## Operator runbook

1. Keep checkout disabled during an incident.
2. Open `/dashboard/admin/payments` with an active administrator account.
3. Search by Growvelt order reference, learner email, or course title.
4. Review order, attempt, event, recovery, and reconciliation states.
5. Use **Verify with Paystack** once. The server either safely finalizes a
   verified success, abandons a conclusive stale failure, or leaves an ambiguous
   payment unchanged.
6. Run reconciliation again and preserve all audit/provider/ledger records.

Never edit a provider payload, mark an order paid manually, insert an
entitlement/enrollment, or rewrite ledger entries.

## Deployment boundary

The migration is forward-only and additive. It does not modify existing Phase
1A order, attempt, provider-event, ledger, entitlement, enrollment, or fixture
history. It must be tested on the isolated local Supabase environment before a
separate founder approval for production deployment.
