# Phase 5 — admin operations workspaces, 16 October 2026

## Completed group

| Route | Upgrade |
| --- | --- |
| `/dashboard/admin/payments` | Matching responsive header/cards, top workspace navigation, loaded-order summary, existing server search plus local reference/learner/course search, status filter and name sorting. |
| `/dashboard/admin/commercial` | Section shortcuts for release/intake/history/reconciliation/profiles/audit/allocations, scoped record summaries, searchable status-filtered allocations, responsive finance cards. |
| `/dashboard/admin/company-commercial` | Consistent header, top back link, transfer/bank-credit/repayment shortcuts, balanced evidence panels and safe dates. Existing unavailable-data notices and recording gates are retained. |
| `/dashboard/admin/promotions` | Campaign/coupon section navigation, scoped campaign/code/redemption summaries, searchable status-filtered registers, responsive forms and safe dates. |
| `/dashboard/admin/enterprise-contracts` | Create/register shortcuts, scoped agreement/workspace summaries, reference/company/scope search, state filters, name sorting and responsive record/form layout. |

Counters describe loaded records, not global financial balances. Enabled coupons are not represented as necessarily redeemable. Company evidence reads retain their original limits and purchase-ID scoping. Contract states remain date-derived reference information, not access grants or commercial obligations. The single workspace select no longer inherits the multi-select's 120px minimum height.

The shared record collection keeps cards mounted when filtering/sorting, preserving unsent notes and existing action state. New operation-specific search/status text remains English, matching these existing English-only admin pages; shared reset/sort/no-match controls retain EN/FR/ES support. This is not a claim that all operational content is translated.

## Safety and checks

- All seven existing writer/action files are byte-for-byte unchanged: payment recovery/refund, commercial release/Test payout, company seller evidence, promotion actions and enterprise-contract actions. All RPC/query bodies, admin layout protection, amounts, confirmation requirements, schema-read errors, feature flags and append-only constraints remain unchanged.
- A read-only TypeScript AST comparison against the prior commit confirmed every backend query, financial-control property and feature-flag declaration in all five pages is unchanged.
- Corrected obsolete commercial copy that said no transfers were available even though controlled Test payout controls exist. No Live activation or additional financial capability was introduced.
- `node scripts/test-phase5-admin-operations.mjs`: actual five-page rendering with isolated backend mocks, loaded summaries, date fallbacks, valid section anchors, empty/read-error states, retained fields, disabled recording/refund gates and parent admin guard. No requests or mutations.
- All eight Phase 5 UI suites passed, as did focused lint, production build/TypeScript, and existing refund, Test payout-transfer and enterprise-register application boundary checks.
- Computer-use skill used for local-only presentation QA: process explicitly set to `http://127.0.0.1:54321` with blank keys. Checked 320/375px phone, 768px tablet and desktop, light/dark, French/Spanish shared labels; tested layouts had no page-wide horizontal overflow. Search/no-match/reset and status filters worked. An unsent refund note survived filtering; the existing refund form was opened and cancelled, never submitted. Financial buttons and fixture saves were not executed.
- Temporary review files removed; viewport and original language/theme restored. No database/Auth/Storage writes, migrations, env configuration, Docker, hosted resources, Careers, notification or security-roadmap changes. Unrelated Earnings, enterprise-design notes, PWA, media and build-cache work remains excluded.
- Exact disposable Next development type-cache files were removed after checking their generated-file headers before the final successful production build; no persisted application data was removed.

## Resume here

The review and financial/operations admin groups are now upgraded. Instructor Earnings and the initial coverage audit are completed in the [Earnings/coverage checkpoint](phase5-earnings-and-coverage.md). Next: authentication presentation, then shared states and remaining secondary-page coverage. Do not declare Phase 5 complete or begin Phase 6 launch hardening without checking those remaining items. Notifications remain excluded. Live subscription/payment activation is a separate operational-readiness task, not a consequence of UI completion.
