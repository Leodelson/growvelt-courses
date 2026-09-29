# Growvelt Learning roadmap checkpoint — 29 September 2026

This is a status checkpoint, not a replacement for the agreed roadmap.

| Phase | Current position |
| --- | --- |
| 1A, 1B1, 1B2 | Test-payment checkout, recovery, refunds/disputes and payment-operations foundations exist. Their live-domain equivalents are not all active. |
| 1B3 | Live-mode configuration and learner charge-domain foundations exist, but first real-money checkout and controlled cutover have **not** happened. |
| 1C, 1D, 1E | Provider commerce, allocation/earnings and payout foundations exist. Payout provider operations remain Test Mode. |
| 2A, 2B | Training-organization and provider-profile/verification/reporting foundations exist. |
| 3A, 3B | Company workspaces, invitations, assignments, progress and reporting are in use. |
| 3C | Per-employee paid-course purchases and private company billing history have passed a Test Mode browser checkout. Live billing, subscription/seat plans and full commercial controls remain open. |
| 4 | Advanced monetization: **not started**. |
| 5 | Full premium UI/UX modernization: **not started**. Targeted fixes so far do not replace this phase. |
| 6 | Final performance, accessibility, security, monitoring, SEO/PWA and regression hardening: **not complete**. |

## Current safe sequence

1. Preserve the confirmed Test Mode company purchase flow.
2. Add explicit payment-domain binding for company attempts and test the database migration.
3. Complete live-capable learner and company charge paths behind independent disabled switches, including verified webhook/reconciliation and recovery.
4. Review live refunds, disputes, payout boundaries, operator procedures and production configuration before any real-money cutover.
5. With explicit approval, enable a controlled low-value first live transaction and verify fulfillment, ledger, operations and rollback/kill switches.
6. Finish remaining Phase 3C business billing scope, then Phase 4, Phase 5 and Phase 6 in order. Continue fixing obvious UI defects along the way.

Do not infer Live Mode approval from the existence of a Paystack live key or from a successful Test Mode transaction.

## Deployment preflight observed today

- The Supabase dashboard lists the company Test checkout migration (`20260940000000`) and payment-function lockdown (`20260941000000`). The local checkout-status fix (`20260942000000`) is not recorded in that migration list; reconcile this history before the next schema push.
- The Vercel Production variable list contains the legacy `PAYSTACK_SECRET_KEY` but no `PAYSTACK_LIVE_SECRET_KEY` or independent live-company switch. Variable **values were not inspected**. Do not flip `PAYSTACK_MODE` while the test key remains configured in Production; the server configuration rejects mixed domains.
- The Supabase CLI could identify the linked project, but its direct database connection timed out during `migration list --linked`. The new company-domain migration is therefore **not applied** and app code requiring it must not be deployed yet.
- Existing company purchases grant paid seats after verification but do not yet write the marketplace sales allocation/ledger entries used for instructor earnings. This accounting gap must be closed before enabling **real-money company checkout**. Likewise, live refund/dispute and payout operations need explicit policy and implementation review rather than inheriting the Test Mode handlers.
- Before switching the single production Paystack mode, drain or reconcile in-flight Test Mode charges: the webhook endpoint validates signatures with the key for only the configured mode.
