# Growvelt Learning roadmap checkpoint — updated 7 October 2026

This checkpoint supersedes the 29 September status snapshot where they differ. It records completed foundations separately from work still required to declare a phase closed.

| Phase | Current position |
| --- | --- |
| 1A, 1B1, 1B2 | Test-mode checkout, recovery, refund/dispute and payment-operations foundations exist. Remaining live-domain and operational readiness is not implied complete. |
| 1B3 | Live-mode safeguards exist, but no controlled first real-money learner purchase has been completed. |
| 1C, 1D, 1E | Provider commerce, commission/earnings and payout foundations exist. They still need final live-operation verification; company seller proceeds remain separate and disabled. |
| 2A, 2B | Training organizations, provider identity/verification and related reporting are implemented. |
| 3A, 3B | Company workspaces, invitations, course assignments, progress and reports are implemented and have been tested. |
| 3C | Company per-employee paid-course checkout passed Paystack Test Mode testing. Commercial ledger, reversal accounting, payout-review, transfer/recovery and settlement-to-bank evidence foundations are deployed. The linked Courses project's migration history was reported synchronized through `20261014000000`; the user's CLI output showed local and remote matching. The admin evidence page is deployed and was manually confirmed to load. Company seller outflow and automatic transfers remain disabled. Phase 3C is still open pending a separately approved Live payment, a reconciled Paystack settlement batch and bank credit, then a locked release/reservation writer and final verification. |
| 4 | Advanced monetization — not started. |
| 5 | Platform-wide premium UI/UX modernization — not started. Targeted fixes do not close this phase. |
| 6 | Final performance, accessibility, security, monitoring, SEO/PWA and regression hardening — not complete. |

## Current production boundary

- Commit `003b2e5` (`Account for company reversals from available proceeds`) is on `origin/main` and was verified Ready in Vercel Production.
- The linked Supabase ref is `qtcpjcaoptdunuefwvgc` (Growvelt Courses Project), not the separate Growvelt Auth/Careers project. The user's read-only CLI output reported local and remote migration histories matching through `20261014000000`. No migration was applied during this checkpoint update.
- No reconciled Live company settlement plus matching bank credit has been established in this workflow. Company seller release/reservation and outflow remain gated off; Test Mode company purchases are not seller earnings.
- A server-only verifier checks a company transfer reference against Paystack's successful Live response, recipient code, NGN amount and source. The Learning Admin route calls it only behind an explicit flag that is off by default. It cannot initiate a transfer; company transfers remain disabled. The provider lookup is Paystack's documented [Verify Transfer GET endpoint](https://paystack.com/docs/api/transfer/).
- Applied migration `20261009000000` adds private, append-only storage for admin-verified successful Live transfers, tied to the exact reserved seller amount, recipient profile, company sale and transfer boundary. Migration `20261012000000` adds its narrowly scoped writer. The writer records evidence for a transfer that already happened; it does not initiate one.
- Applied migration `20261010000000` permits verified refund/lost-dispute recovery through a private seller receivable only when the remaining seller balance has verified Live transfer evidence, settlement evidence, prior active-admin approval, and reconciled release/reservation ledgers. Mixed, partial, missing, or reserved balances fail closed. It does not collect debt or deduct from future earnings.
- Applied migration `20261011000000` adds a private, append-only record for repayment references an active Learning Admin independently confirmed, a balanced cash-clearing/receivable journal, and outstanding-balance reconciliation. Its service-role RPC cannot collect funds or debit earnings; its admin route is feature-gated.
- Applied migration `20261013000000` adds private, append-only bank-credit evidence keyed by Paystack settlement batch. An admin compares the payout with the bank statement and records the exact amount, date and statement-line reference. The server independently re-fetches Live settlement/charge data and the database requires a previously verified company charge, active admin and exact amount match. This is an admin attestation, not a bank API integration or uploaded document; it does not release or transfer proceeds.
- Applied migration `20261014000000` accounts for company reversals against available seller proceeds while preserving reserved/unavailable amounts as liabilities; it does not automatically deduct future earnings or move money.
- The confirmed company Test Mode purchase remains accessible and excluded from seller earnings under the owner's decision. No production company seller outflow or live company attempt was found at the latest checkpoint.
- No Paystack or Vercel secret values were changed as part of this checkpoint.

## Next work, in order

1. Keep all seller-evidence recording and outflow gates off. The admin evidence page's load and fail-closed wiring have been checked; the remaining UI check is narrow-screen/disabled-action presentation, not another schema push.
2. When the owner explicitly approves a real Live purchase, wait for actual settlement, then compare the entire settlement batch (not each course charge) with Paystack payout details and the bank statement. This is a real-money operational step and is not authorized by Test Mode success.
3. Only after matching settlement and bank evidence, implement and test the locked seller release/reservation writer that rechecks evidence, the current release gate, and active-admin approval in one transaction. No automatic transfer.
4. Re-run isolated and production-schema tests, then close 3C only after the above gates pass. Continue Phase 4, Phase 5 and Phase 6 in order; keep earlier live/operational checks visible in Phase 6 launch readiness.

The current isolated accounting checks are documented in [the company commercial accounting design](phase3c-company-commercial-accounting-design.md), and the deployed settlement gate in [the settlement-evidence checkpoint](phase3c-company-settlement-evidence.md). Paystack's primary references are its [Settlements API](https://paystack.com/docs/api/settlement/) and [payout/settlement guide](https://support.paystack.com/en/articles/2125314).
