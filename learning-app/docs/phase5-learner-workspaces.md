# Phase 5 — learner workspace group, 15 October 2026

## Updated pages

| Route | Actual features added |
| --- | --- |
| `/dashboard/my-learning` | Course/instructor/subject search; all/in-progress/not-started/completed filters; recent/title/progress sorting; activity-weighted learning snapshot; nearest completion milestone based on recorded activity counts; responsive course rows and existing lesson-resume links. Completed courses open their overview for review/rating/certificate actions. |
| `/dashboard/saved-courses` | Search, subject/access filters and saved/title/free-first sorting; compare 2–3 courses using published price, subject, level, instructor and real star ratings; remove saved courses through the existing toggle operation, pruning comparison selections after removal. |
| `/dashboard/certificates` | Search by course/reference; issued/revoked filters; issue-date sorting; public verification links; click-to-copy with pending and inline success/failure feedback for issued records only; completed-course shortcuts to the existing certificate eligibility/issue flow. Revoked records remain visible and verifiable but do not offer a sharing shortcut. |

Consistent responsive page headings, statistics, panels, controls, cards and empty/no-match states use scoped CSS and existing theme variables. English, French and Spanish are supported. Secondary course links are omitted when they duplicate the primary destination.

## Data and safety

- Uses existing own-enrollment, own-saved-course and own-certificate queries. No new tables, migrations, auth rules or payment behavior changes.
- Counts reflect the currently loaded library (existing 48-course query limit is retained), not invented platform analytics. No streaks, watch-time figures or recommendations are fabricated.
- Completed-course links do not claim a certificate has been issued or bypass eligibility. The original course overview and issuance checks are unchanged. Issued certificates retain their independent history, including revoked records.
- Saved-course ratings use the existing public aggregate lookup, with no learner identities exposed. Comparison is local UI state; it does not enroll, purchase, save extra records or publish information.
- Copying uses the existing canonical Learning verification origin and only happens after the user clicks. A clipboard failure produces an inline message.
- No hosted/local DB/Auth/Storage test writes were performed. Browser QA used temporary development-only presentation fixtures with local backend URL and no keys, not authenticated hosted accounts. Temporary fixtures were removed after review; no auth bypass is deployed.
- Preserve the existing unrelated earnings, enterprise-doc, PWA, media and build-cache changes.

## Verification

- `node scripts/test-phase5-learner-workspaces.mjs`: pure search/filter/sort/resume logic and EN/FR/ES populated/empty rendering; checks non-mutating filters, one h1, status-aware certificate actions and valid course destinations.
- Browser checks: 320/375px mobile, 768px tablet and default desktop; light/dark; longer French/Spanish labels; no page-wide horizontal overflow. Comparison scrolls inside its panel.
- Browser interaction checks: search narrows courses, reset restores the library, three comparison selections disable a fourth, real comparison rows render, certificate-copy action displays success using a non-production example reference.
- Focused ESLint, TypeScript and production Next build are release checks. No unrelated files or temporary fixture routes are included in the release.

## Resume order

1. Learner Subscriptions, Profile and Settings — completed in the [account workspace checkpoint](phase5-account-workspaces.md).
2. Dashboard Home/shared shell review — completed in the [Home checkpoint](phase5-dashboard-home.md).
3. Instructor workspace/course creation/curriculum and subscriptions — completed in the [instructor checkpoint](phase5-instructor-workspaces.md). Organization/provider/insights/payout screens — completed in the [provider checkpoint](phase5-provider-workspaces.md). Earnings must be reviewed against the owner's existing uncommitted work before touching it.
4. Company workspace/billing/reports/insights — completed in the [company checkpoint](phase5-company-workspaces.md). Admin review and financial/operations groups — completed in the [review checkpoint](phase5-admin-reviews.md) and [operations checkpoint](phase5-admin-operations.md). Next: Phase 5 coverage audit (separate Earnings work and remaining authentication/shared-state presentation).

Notifications, product-wide commerce changes and later roadmap/security gates remain out of scope for this update.
