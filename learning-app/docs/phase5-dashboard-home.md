# Phase 5 — Dashboard Home and shared navigation, 16 October 2026

## Implemented

- `/dashboard`: responsive overview with actual enrollment/progress/completion/issued-certificate counts, a next-course card, activity-weighted progress, an ongoing/completed shortlist, latest issued certificate, subject counts and existing saved-course/profile/help destinations. Empty and loading states use the same layout. New copy supports English, French and Spanish, without repeated Home action destinations.
- Completed courses always open their overview, never an old resume-lesson URL. Ongoing courses take priority in the featured panel. Certificate selection ignores revoked records, sorts by issue date and safely handles missing/invalid dates. Completion never claims automatic certificate issuance.
- Shared navigation: parent selection on nested course/certificate/company routes; separate instructor Create Course vs My Courses highlighting; active states in mobile workspace links; account links dismiss their popover; language selection closes its list. Existing branding position, course-search form, collapse preference, roles, routes and feature gates are retained.
- Mobile menu: dialog semantics, focus entry/wrapping/restoration, Escape and backdrop dismissal, background scroll locking/inert main/sidebar/bottom navigation, cleanup when resizing to desktop. Small bottom-nav labels wrap instead of clipping; navigation has visible focus outlines and minimum tap targets.
- The existing welcome-email trigger still mounts once in the authenticated server shell. It is outside the presentation-only navigation component, allowing navigation QA without email requests. Email content, delivery route and safeguards are unchanged.

## Verification

- `node scripts/test-phase5-dashboard-overview.mjs`: UI-only summary/routing/navigation fixtures, EN/FR/ES empty/populated/completed rendering, certificate-status filtering, safe totals, unique actions, role-gated links and welcome mounting. No external requests.
- Prior learner-library, account-workspace, subscription-management and enterprise-register regression checks are retained. Focused lint and production build are release checks; existing signed-avatar raw-image lint warnings in navigation predate this update.
- Browser review used temporary development-only fixtures with the development process explicitly targeting `http://127.0.0.1:54321` and no backend keys. No DB/Auth/Storage writes, payment clicks, sign-out calls or welcome-email requests. Fixtures were removed before release.
- Checked 320px/375px mobile, 768px tablet and desktop, English/French/Spanish, light/dark, empty/populated content, role navigation, shortlist switching, sidebar collapse/search expansion and Escape dismissal. Mobile keyboard focus wraps in both directions, Escape restores its trigger, and resizing closes the drawer and restores scrolling. Viewport and local test language/theme preferences were restored.

## Next checkpoint and exclusions

Instructor workspace, course list, authoring/curriculum and subscriptions are completed in the [instructor checkpoint](phase5-instructor-workspaces.md). Organizations, provider profiles/insights and payout profile are completed in the [provider checkpoint](phase5-provider-workspaces.md). Company workspaces/billing/reports/insights are completed in the [company checkpoint](phase5-company-workspaces.md). Admin reviews and financial/operations pages are completed in the [review checkpoint](phase5-admin-reviews.md) and [operations checkpoint](phase5-admin-operations.md). Next: Phase 5 coverage audit. Review the owner's unrelated uncommitted earnings work before editing that screen; remaining authentication/shared-state presentation must also be inspected.

Notifications content/behavior, payment modes, commercial/security gates, migrations, Docker, hosted data and Growvelt Careers remain unchanged. The comprehensive Phase 5 redesign is not complete, and Live subscription activation requires its own readiness review.
