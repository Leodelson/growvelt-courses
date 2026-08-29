# Phase 1B2C payment policy and operations runbook

## Approved business defaults

- Routine full refunds: within 14 calendar days, below 20% lesson completion, not completed, and no issued certificate.
- Full refunds only. `exceptional_admin_refund` is the audited administrator override.
- Processed refunds and authoritative chargebacks revoke future access but retain learning history.
- Refunded learners may repurchase through a new order; prior orders, entitlements, ledger, and audit history remain immutable.
- Refund contact: `refund@growvelt.com`. General support: `support@growvelt.com`.
- Targets: acknowledge refunds within one business day, review within two; review new disputes within four business hours and always before Paystack's actual deadline.

These are configurable business rules, not representations of statutory rights. The published policy requires legal review before live activation.

## Operator actions

- **Paid but access missing:** locate the order, inspect events/reconciliation, then use provider verification once when appropriate. Never insert access or ledger rows manually.
- **Pending payment:** ask the learner not to repay; allow the webhook; verify only after a meaningful delay or confirmed incident.
- **Abandoned payment:** cancel only after Paystack authoritatively reports failed/abandoned.
- **Refund requested:** confirm policy eligibility or document the exceptional reason, require the exact order reference, and submit once.
- **Refund pending/attention:** do not reverse access or money prematurely. Allow the signed webhook; use verification only for delayed/divergent state.
- **Refund processed:** verify one compensating ledger, refunded entitlement, cancelled enrollment, preserved capture/history, and clean reconciliation.
- **Dispute opened/reminded:** assign an operator, monitor the Paystack deadline, gather order/access/support evidence, and retain access while unresolved.
- **Dispute won:** retain payment and access; no reversal.
- **Dispute lost/accepted:** verify one chargeback reversal, revoke access, preserve learning history, and separately assess certificate fraud revocation.
- **Reconciliation finding:** stop related operator actions and investigate provider event, case, ledger, entitlement, and enrollment. Never repair financial truth with ad hoc SQL.

Notification delivery failures are operational incidents only. They must never roll back or alter authoritative financial state.

## Kill switch

Set `PAYMENTS_CHECKOUT_ENABLED=false`, redeploy, and confirm initialization returns `checkout_disabled`. Keep the webhook available for in-flight transactions. Set `PAYMENTS_REFUNDS_ENABLED=false` to stop new refund initiation while retaining webhook/recovery processing.
