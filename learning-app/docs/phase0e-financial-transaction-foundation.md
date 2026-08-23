# Phase 0E financial transaction foundation

Phase 0E adds a payment-provider-neutral financial data model. It does not add
checkout, Paystack, paid-course publication, provider earnings, commissions,
payouts or browser access to financial records.

## Approved MVP boundary

- One authenticated learner buys one course at a time.
- One-time purchases and NGN only.
- Growvelt is the payment recipient.
- The server will determine the published course price and create an immutable
  purchase-time snapshot in integer kobo.
- Growvelt initially absorbs processor fees.
- An active entitlement prevents repurchase.
- Refunds are admin-controlled; no eligibility window is encoded yet.

## Record model

`learning_orders` is the durable commercial record. It stores an opaque learner
reference, nullable operational foreign keys, course/provider display snapshots,
the final gross amount in kobo, currency and lifecycle state. Snapshot fields
cannot be edited. User or course deletion may detach nullable foreign keys but
does not erase the order.

`learning_payment_attempts` stores retryable provider attempts separately from
the order. Amount and currency must match the authoritative order snapshot.
Idempotency keys and provider references are unique.

`learning_payment_provider_events` is the webhook/idempotency inbox for a future
provider. It records a unique provider event ID, signature result, SHA-256
payload digest, minimized JSON payload and processing outcome. Full sensitive
provider payloads must not be stored merely because the column is JSON.

`learning_ledger_transactions` and `learning_ledger_entries` form an append-only,
balanced journal. Signed entry amounts for each transaction must sum to zero,
contain at least two lines and use the transaction currency. Account codes are
generic so future processor fees, platform commission and provider liabilities
can be recorded without rewriting historical orders.

`learning_course_entitlements` links a successful paid order to learner access
and, later, its enrollment. It is operational access state rather than proof of
payment. One learner/course and one entitlement/order are enforced.

`learning_payment_cases` models refund and chargeback workflows without encoding
a customer eligibility window. Case amount, state, provider reference, actor and
resolution timestamp are retained and audited.

## Trust boundaries

All seven financial tables have RLS enabled and no `anon` or `authenticated`
table privileges or policies. Only server/database roles can currently access
them. No application route calls them in Phase 0E.

Future checkout must accept only a course ID from the browser. The server must
load the current published paid course, convert its final NGN price to kobo,
create the order/attempt, and send that exact amount to the provider. Browser
redirects and callbacks must never mark an order paid.

Only a signature-verified, idempotent webhook or an authenticated server-side
verification may finalize a payment. Finalization must atomically post balanced
ledger entries, mark the order paid, and create the entitlement/enrollment.

## Reconciliation contract

Each reconciliation run should compare provider transactions with local
attempts, provider events, paid orders and ledger captures by provider reference,
amount and currency. Exceptions include provider-only success, local-only
success, amount mismatch, duplicate capture, missing ledger entries, missing
entitlement and unresolved refund/chargeback.

No automatic correction should rewrite ledger rows. Corrections use new balanced
adjustment transactions and immutable audit events. Failed webhook processing
must be retryable and alertable before live-money activation.

## Legacy isolation

`course_registrations` is retained without data changes, but browser insertion
and direct browser access are removed. It is not an order, payment, ledger or
entitlement source and must not be reused by Phase 1.

## Deferred decisions

Before live money: approve refund eligibility/legal wording, receipt and support
processes, production reconciliation ownership, alerting, and incident response.
Provider commission percentages, earnings availability and payouts remain
deferred; the generic journal and commercial-terms version allow those rules to
be introduced prospectively.
