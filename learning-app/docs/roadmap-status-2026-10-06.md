# Growvelt Learning roadmap checkpoint — 6 October 2026

This checkpoint supersedes the 29 September status snapshot where they differ. It records completed foundations separately from work still required to declare a phase closed.

| Phase | Current position |
| --- | --- |
| 1A, 1B1, 1B2 | Test-mode checkout, recovery, refund/dispute and payment-operations foundations exist. Remaining live-domain and operational readiness is not implied complete. |
| 1B3 | Live-mode safeguards exist, but no controlled first real-money learner purchase has been completed. |
| 1C, 1D, 1E | Provider commerce, commission/earnings and payout foundations exist. They still need final live-operation verification; company seller proceeds remain separate and disabled. |
| 2A, 2B | Training organizations, provider identity/verification and related reporting are implemented. |
| 3A, 3B | Company workspaces, invitations, course assignments, progress and reports are implemented and have been tested. |
| 3C | Company per-employee paid-course checkout has passed Paystack Test Mode testing. Commercial ledger, reversals, payout-review and settlement-evidence foundations are deployed. The phase remains open: company live billing and seller outflow are disabled pending post-outflow refund/dispute accounting, bank-settlement reconciliation, release/reservation operations, runtime procedures and an approved live transaction. |
| 4 | Advanced monetization — not started. |
| 5 | Platform-wide premium UI/UX modernization — not started. Targeted fixes do not close this phase. |
| 6 | Final performance, accessibility, security, monitoring, SEO/PWA and regression hardening — not complete. |

## Current production boundary

- The last confirmed source commit on `main` is `2f5a409`. Vercel Production deployment status has not been rechecked in this checkpoint.
- Supabase migrations 43–63 are applied. Migration 64 is prepared locally and has **not** been applied to production; it only adds private transfer-evidence storage and read-only reconciliation.
- The exact settlement-evidence state remains `settlement_verified_release_writer_not_enabled`. The live-accounting readiness function is absent; company live checkout and company seller payouts are disabled.
- A server-only, read-only verifier now checks a company transfer reference against Paystack's successful Live response, recipient code, NGN amount and source. Its isolated tests use a fake provider response. No route calls it, and it creates no database evidence or accounting entry; company transfers remain disabled. The provider lookup is Paystack's documented [Verify Transfer GET endpoint](https://paystack.com/docs/api/transfer/).
- Draft migration 64 adds private, append-only storage for an admin-verified successful Live transfer, tied to its exact reserved seller amount, recipient profile, company sale and transfer boundary. It grants only service-role reads and reconciliation; no role can insert evidence yet. Local PGlite and schema-export checks pass, but production schema/data/RLS were not changed.
- The confirmed company Test Mode purchase remains accessible and excluded from seller earnings under the owner's decision. No production company seller outflow or live company attempt was found at the latest checkpoint.
- No Paystack or Vercel secret values were changed as part of this checkpoint.

## Next work, in order

1. Review the transfer-evidence operator path, then add post-outflow refund/dispute accounting. Refunds after payment to a seller must create a separately tracked manual-recovery receivable; never deduct it from future earnings automatically. Keep evidence and accounting unwritable until their operator paths are reviewed.
2. Complete bank-settlement reconciliation and runtime recovery/review procedures. Paystack's settlement-to-charge match alone is not bank-statement proof.
3. Only after those prerequisites, implement the locked seller release/reservation writer that rechecks settlement evidence, the current release gate, and approval in one transaction. No automatic transfer.
4. Re-run isolated and production-schema tests. A first live transaction is a separate, explicitly approved operational step; do not infer permission to spend from successful Test Mode checks.
5. Close 3C, then continue Phase 4, Phase 5 and Phase 6 in order. Earlier-phase remaining live or operational checks must stay visible in the Phase 6 launch-readiness checklist rather than being silently treated as complete.

The current isolated accounting checks are documented in [the company commercial accounting design](phase3c-company-commercial-accounting-design.md), and the deployed settlement gate in [the settlement-evidence checkpoint](phase3c-company-settlement-evidence.md).
