# Phase 5 — company workspaces, 16 October 2026

## Completed pages

| Route | Upgrade |
| --- | --- |
| `/dashboard/company` | Responsive workspace summary, role-aware reporting/billing navigation, workspace search/role/sort, per-workspace occupied-seat display, organized membership/invitation/assignment/purchase panels. |
| `/dashboard/company/billing` | Purchase/paid-seat/paid-total summaries, course/provider/reference search, status and total sorting, responsive history cards and safe date fallbacks. Pending checkouts do not contribute to paid totals. |
| `/dashboard/company/reports` | Search employee/email/course/company, assignment-state filters and progress sorting, accessible progress cards with details links. Cancelled assignments remain searchable but are not counted as completed assignments. |
| `/dashboard/company/insights?assignment=…` | Back link to reports, recorded progress/state/date summary, cancellation-aware explanation and assignment context. Invalid, missing and unauthorized assignments remain unavailable. |

Shared form actions now use the existing pending-spinner button. No new endpoint or mutation is introduced. Overview counts cover loaded authorized records, not invented platform analytics. Seat usage is informational; actual seat/invitation limits remain enforced by existing operations. Paid totals are purchase snapshots, not refund-adjusted settlement balances, receipts or tax invoices. Completion does not claim certificate issuance or current access after cancellation.

## Safety

- Existing session, owner/admin/member scoping and manager-authorized purchase-ID lookup are retained. No arbitrary purchase references are loaded; employee accounts do not gain manager reports or billing.
- Source comparison confirmed every company async mutation/checkout handler is unchanged. Existing invitation decline/cancellation/member-removal confirmations remain. Test-only checkout UI gates and all server payment/security gates remain unchanged.
- No SQL, API route, hosted data, environment configuration, Docker, Careers, security-roadmap or notification changes. Owner's separate earnings, enterprise-doc, PWA, media and build-cache work is excluded.
- Computer-use skill used for presentation-only QA with a process explicitly targeting local Supabase and blank keys. Only local search/filter/course/employee selection was exercised. No invitation, assignment, purchase, payment, Auth, database or Storage write tests were submitted.
- Temporary fixtures removed; viewport and appearance restored before release. No auth bypass is deployed.

## Verification

- `node scripts/test-phase5-company-workspaces.mjs`: four actual pages rendered with isolated backend mocks; auth and manager/member scope; authorized reference-ID lookup; Test/live/disabled UI gates; schema-pending and empty states; paid-only totals, cancelled/completed distinction, dates and bounded display progress.
- `node --experimental-strip-types scripts/test-phase3c-company-live-readiness.mjs`: static existing payment-domain/reversal/access/default-off live gate checks. No live activation is implied.
- Focused ESLint, all six UI regression suites and the production build (including TypeScript) passed. A malformed disposable `.next/dev/types/routes.d.ts` cache file was removed after checking its generated-file header; the rebuild succeeded. No source or persisted data was deleted for recovery. The existing payment test emits Node's package-module-type warning; package settings are not changed to suppress it.
- Browser checked 320/375px mobile, 768px tablet and desktop, light/dark, report search/status, billing reference/status filters, progress cards and two-employee purchase summary. Checked layouts had no page-wide horizontal overflow. Checkout was not clicked.

## Resume here

The first admin-review group is completed in the [admin review checkpoint](phase5-admin-reviews.md). Next: remaining financial/operations admin pages (payments, commercial, company commercial, promotions/coupons and enterprise contracts). Instructor Earnings still requires reviewing the owner's separate changes before modifying or releasing it. Notifications and Live payment activation remain separate. Phase 5 is not yet complete.
