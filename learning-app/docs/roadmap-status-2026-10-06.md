# Growvelt Learning roadmap checkpoint — 6 October 2026

This checkpoint supersedes the 29 September status snapshot where they differ. It records completed foundations separately from work still required to declare a phase closed.

| Phase | Current position |
| --- | --- |
| 1A, 1B1, 1B2 | Test-mode checkout, recovery, refund/dispute and payment-operations foundations exist. Remaining live-domain and operational readiness is not implied complete. |
| 1B3 | Live-mode safeguards exist, but no controlled first real-money learner purchase has been completed. |
| 1C, 1D, 1E | Provider commerce, commission/earnings and payout foundations exist. They still need final live-operation verification; company seller proceeds remain separate and disabled. |
| 2A, 2B | Training organizations, provider identity/verification and related reporting are implemented. |
| 3A, 3B | Company workspaces, invitations, course assignments, progress and reports are implemented and have been tested. |
| 3C | Company per-employee paid-course checkout has passed Paystack Test Mode testing. Commercial ledger, reversals, payout-review and Paystack settlement-evidence foundations are deployed. Migrations 64–68 prepare private transfer/recovery and batch-to-bank evidence; they are not production-applied. The admin evidence page and feature-gated API routes are prepared, but actions remain off by default. The phase remains open: live company billing and seller outflow are disabled pending schema application/verification, an actual reconciled Live settlement, release/reservation operations and an approved live transaction. |
| 4 | Advanced monetization — not started. |
| 5 | Platform-wide premium UI/UX modernization — not started. Targeted fixes do not close this phase. |
| 6 | Final performance, accessibility, security, monitoring, SEO/PWA and regression hardening — not complete. |

## Current production boundary

- The previous source checkpoint pushed to `main` is `ba3bf47`. Vercel Production deployment status has not been rechecked after that push.
- Supabase migrations 43–63 are applied. Migrations 64–68 are prepared in code and have **not** been applied to production.
- The exact settlement-evidence state remains `settlement_verified_release_writer_not_enabled`. The live-accounting readiness function is absent; company live checkout and company seller payouts are disabled.
- A server-only verifier checks a company transfer reference against Paystack's successful Live response, recipient code, NGN amount and source. The Learning Admin route calls it only behind an explicit flag that is off by default. It cannot initiate a transfer; company transfers remain disabled. The provider lookup is Paystack's documented [Verify Transfer GET endpoint](https://paystack.com/docs/api/transfer/).
- Draft migration 64 adds private, append-only storage for an admin-verified successful Live transfer, tied to its exact reserved seller amount, recipient profile, company sale and transfer boundary. The service role can read/reconcile it; migration 67 adds its narrowly scoped writer. Local PGlite and schema-export checks pass, but production schema/data/RLS were not changed.
- Draft migration 65 lets a verified refund/lost dispute use a private seller-recovery receivable only when the entire remaining seller balance has verified Live transfer evidence, settlement evidence, prior active-admin approval, and reconciled release/reservation ledgers. Mixed, partial, missing, or reserved balances still fail closed. It does not collect the debt, deduct from future earnings, initiate a transfer, or expose company finances to instructors. Production remains unchanged, and the existing admin reversal endpoint is Test-only.
- Draft migration 66 adds a private, append-only record for repayment references an active Learning Admin has independently confirmed, a balanced cash-clearing/receivable journal, and outstanding-balance reconciliation. Its service-role RPC cannot collect funds or debit earnings; an admin route calls it only behind an explicit flag that is off by default. Production remains unchanged.
- Draft migration 67 adds a service-role-only writer that records Paystack Live transfer evidence against an existing transferred boundary after the server has verified the provider response. The route checks admin session, same origin, the exact reserved boundary, active Live recipient, and an explicit feature flag. It never initiates a transfer; the flag stays off by default.
- Draft migration 68 adds private, append-only bank-credit evidence keyed by the Paystack settlement batch. An admin must compare the payout in Paystack with the actual bank statement and record the exact credit amount, date and statement-line reference. The server independently re-fetches the Live settlement/charge and requires the bank credit to equal Paystack's `effective_amount`; the database also requires a previously verified company charge in that batch, an active admin, and an exact amount match. This is an admin attestation against a statement, not a bank API integration or uploaded document. It never releases or transfers proceeds; the reconciliation flag stays off.
- The confirmed company Test Mode purchase remains accessible and excluded from seller earnings under the owner's decision. No production company seller outflow or live company attempt was found at the latest checkpoint.
- No Paystack or Vercel secret values were changed as part of this checkpoint.

## Next work, in order

1. Test the admin evidence screen's unavailable-schema, disabled-action, and responsive states. Keep recording flags off. Never deduct from future earnings automatically.
2. Apply and verify the prepared migrations before enabling any evidence action. Then, only after an explicitly approved Live payment has actually settled, compare that whole batch (not each individual course charge) with the Paystack payout details and the bank statement. Paystack documents settlements as payouts to the bank and exposes both the settlement batch and its constituent transactions; the bank-side check remains a human review.
3. Only after those prerequisites, implement the locked seller release/reservation writer that rechecks settlement evidence, the current release gate, and approval in one transaction. No automatic transfer.
4. Re-run isolated and production-schema tests. A first live transaction is a separate, explicitly approved operational step; do not infer permission to spend from successful Test Mode checks.
5. Close 3C, then continue Phase 4, Phase 5 and Phase 6 in order. Earlier-phase remaining live or operational checks must stay visible in the Phase 6 launch-readiness checklist rather than being silently treated as complete.

The current isolated accounting checks are documented in [the company commercial accounting design](phase3c-company-commercial-accounting-design.md), and the deployed settlement gate in [the settlement-evidence checkpoint](phase3c-company-settlement-evidence.md). Paystack's primary references are its [Settlements API](https://paystack.com/docs/api/settlement/) and [payout/settlement guide](https://support.paystack.com/en/articles/2125314).
