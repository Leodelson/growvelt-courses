# Phase 5 — instructor authoring workspaces, 16 October 2026

## Completed in this group

| Route | Upgrade |
| --- | --- |
| `/dashboard/instructor` | Responsive teaching overview, actual publishing-stage counts, course search/status/sort and enrollment analytics. Totals are labeled course enrollments, not unique people. |
| `/dashboard/instructor/courses` | Consistent course rows, editor links, last-updated dates, existing server search/filters/pagination and action menus. |
| `/dashboard/instructor/courses/new` | Authoring workflow, live metadata checklist and character counts, organized responsive form. |
| `/dashboard/instructor/courses/[courseId]` | Same workflow and metadata aids, retained curriculum/submission panels and read-only states. |
| `/dashboard/instructor/courses/[courseId]/curriculum` | Actual module/lesson/quiz/video-minute summary, module shortcuts, responsive editor and one page-level heading. |
| `/dashboard/instructor/subscriptions` | Plan search/status/sort, eligible-course search and selected-course counts, responsive draft/setup/history panels. |

The checklist checks metadata only; it does not declare publication eligibility. Video minutes use saved video durations only, not estimated reading or quiz time. Filters preserve mounted action components and checked course inputs, including selections hidden by search.

## Safety and verification

- Existing ownership, instructor approval, review/submission, published-course read-only, mixed-commercial-terms and Company Test Mode separation checks remain. Save, curriculum mutations, archive/delete confirmations and provider setup actions are retained.
- No payment activation, migration, environment setting, Docker, hosted data, Careers or notifications changes. Unrelated earnings, enterprise documentation, PWA, media and build-cache changes are excluded.
- `node scripts/test-phase5-instructor-workspaces.mjs`: isolated six-page EN/FR/ES rendering, empty/populated states, filtering, totals, metadata boundaries, module anchors and editing/setup restrictions. Backend dependencies are mocked; no external requests.
- Subscription provider/private-checkout and prior Home/account/learner-library regression suites passed. Focused ESLint and the production Next build (including TypeScript) passed. The two existing subscription scripts still emit Node's package-module-type warning; no payment or package configuration was changed to suppress it.
- Computer-use skill used for live presentation-only browser checks: 320/375px mobile, 768px tablet and desktop; English/French/Spanish and light/dark. Verified live checklist, filters, retained hidden selections, rejection of mixed private/public selections, published metadata disabled state and expanded text lesson. No page-wide horizontal overflow in checked layouts.
- Browser process explicitly used the local Supabase URL with no keys. No save, provisioning, payment, DB/Auth/Storage write tests were run. Temporary review routes were removed and viewport/language/theme restored before release.

## Resume here

Organization, provider-profile, provider insights and payout-profile screens are completed in the [provider checkpoint](phase5-provider-workspaces.md). Company workspaces/billing/reports/insights are completed in the [company checkpoint](phase5-company-workspaces.md). Next: admin-review screens. Review the owner's unrelated earnings changes before modifying Earnings. This checkpoint does not mark every instructor or Phase 5 page complete. Live subscription activation needs its own readiness review.
