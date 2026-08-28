# Phase 1B2B disputes and chargebacks

Phase 1B2B extends the existing payment-case, provider-event, ledger, entitlement, enrollment, audit, and reconciliation architecture. It does not create a second dispute subsystem.

Paystack's signed `charge.dispute.create`, `charge.dispute.remind`, and `charge.dispute.resolve` events are durably stored before processing. Raw-body HMAC validation remains mandatory. Dispute creation and reminders never reverse money or access. An unresolved dispute keeps the paid order, entitlement, and enrollment active.

Normalized states are `action_required`, `submitted`, `under_review`, `won`, and `lost`; the exact Paystack status and resolution remain separately stored. A terminal `declined` resolution is treated as won and preserves payment/access. A terminal `merchant-accepted` resolution is treated as financial loss and appends one balanced `chargeback` ledger transaction, marks the order `chargeback`, revokes the entitlement, and cancels—but does not delete—the enrollment. Learning progress, quiz history, completion history, and certificate snapshots are retained.

The provider API `GET /dispute/:id` is available as a guarded administrator recovery check. Its event provenance is `provider_api`, never `webhook`. The browser supplies only the local case ID; the server resolves the authoritative dispute/order relationship and uses its server-only Paystack test secret.

Payment Operations shows dispute amount, category/reason, provider status, deadline, timeline, resolution, and a narrow verification action. Evidence submission and dispute resolution remain Paystack Dashboard/operator-runbook tasks.

Paystack documents Test Mode dispute API resources, but does not document a deterministic merchant-controlled mechanism that creates a genuine issuer dispute/chargeback against a chosen test transaction. Therefore production dispute records must not be fabricated merely to exercise the flow. Local signed fixtures provide deterministic coverage until Paystack offers or confirms an official test procedure.

Operationally monitor the Paystack disputes email and Dashboard. `action_required` cases approaching their response deadline and all dispute reconciliation findings require prompt administrator attention.
