# Phase 5 — account workspace group, 16 October 2026

## Completed in this group

| Route | Upgrade |
| --- | --- |
| `/dashboard/subscriptions` | Responsive billing header, counts of actual loaded plan statuses, plan/course search, status filter, plan-name/access-end sorting, reset/no-match states and expandable billing guidance. Existing Paystack eligibility and management destinations remain unchanged; no management endpoint prefetch. |
| `/dashboard/profile` | Page heading and settings link, section shortcuts, compact cover/identity layout, actionable profile checklist, actual photo/link counts, responsive link editor styling. Photo upload is no longer hidden from assistive technology. The checklist says account email rather than inventing an email-verification claim. |
| `/dashboard/settings` | Search and category filtering, persistent mounted controls while filtering, live language/theme summary, direct access to the existing cookie-preferences dialog and privacy policy. Duplicate profile CTA removed; existing role-aware workspace/application links, password recovery and guarded deletion control retained. |

English, French and Spanish copy is included for new controls. Existing profile name/photo/link save operations and organization-provider branding reads are preserved. No new backend features or permission changes are introduced.

## Verification and boundaries

- `node scripts/test-phase5-account-workspaces.mjs`: isolated server-rendering fixtures for three locales, populated/empty subscriptions, search/status/sorting, invalid/missing dates, non-mutating inputs, original management eligibility, preserved account controls, one page heading and one settings-to-profile CTA.
- Existing Phase 4 subscription-management and Phase 5 learner-library regressions pass. Focused lint, TypeScript and production build are release checks.
- Browser QA used temporary development-only presentation fixtures with the process URL explicitly set to `http://127.0.0.1:54321`; no backend writes or payment actions were connected. Fixtures are removed before release. Search narrowed plans/settings; reset/category controls worked; cookie preferences opened; language/theme controls and live summary updated.
- Tested 320px/375px mobile, 768px tablet and default desktop, light/dark and longer Spanish labels; checked for page-wide horizontal overflow. Viewport and pre-existing local test preferences were restored.
- No database/Auth/Storage test writes, migration changes, secrets, live-payment switches, notifications, Docker changes or Careers changes. Unrelated earnings, enterprise notes, PWA, media and build-cache work stays excluded.

## Payments and next checkpoint

UI completion does not authorize Live subscription checkout. Preserve Test Mode labels/gates until a separate production payment-readiness review verifies the applicable commercial, provider, settlement/reconciliation and launch safeguards. One-time purchases and other existing payment flows are not switched by this update.

Dashboard Home/shared shell review is completed in [the Home checkpoint](phase5-dashboard-home.md). Resume with instructor workspace/course authoring/curriculum/subscriptions, company workspaces/billing/reporting/insights and admin-review screens. Instructor/admin pages have earlier targeted improvements but have not received a comprehensive Phase 5 redesign. Review existing uncommitted instructor-earnings work before touching it. Notifications remain excluded.
