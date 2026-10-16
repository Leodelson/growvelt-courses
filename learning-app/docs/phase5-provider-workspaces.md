# Phase 5 — provider workspaces, 16 October 2026

## Updated pages

| Route | Upgrade |
| --- | --- |
| `/dashboard/instructor/organizations` | Membership/active/owned/invitation summary using existing reads; section shortcuts; organization name/handle search, role filter and course-count sorting; responsive team, course, profile and invitation panels. |
| `/dashboard/instructor/organizations/[organizationId]/profile` | Top back link; branding/details/verification anchors; saved setup progress with linked checklist; live headline/description counters; responsive editor; accessible cover/logo controls. |
| `/dashboard/instructor/organizations/[organizationId]/insights` | Course search/status/sort; actual saved enrollment/sale dates with missing-date fallbacks; responsive reporting cards. Totals are labeled course enrollments, not unique people. |
| `/dashboard/instructor/payout-profile` | Masked recipient/history cards, explicit Test/Live history labels, practical setup FAQs, empty state, loading feedback and confirmation before disabling a Test recipient. |

Existing create, invite, accept, profile-save and verification buttons use the shared pending spinner. Existing cancellation/removal dialogs are retained. Payout validation captures the form element before awaiting the response, so the existing success reset does not dereference a cleared event target.

## Safety and scope

- No API route, SQL migration, authorization, payment mode, production environment, Docker, Careers, security-roadmap or notification changes.
- Active-owner management, approved-instructor gates, member reporting access, private-until-verified profiles and Test-only payout setup are preserved. No member data or earnings queries were broadened.
- Organization filters preserve mounted forms/actions. Saved progress is not a live eligibility check; optional images and Admin verification are distinguished from required profile details.
- Browser QA uses the computer-use skill and temporary presentation fixtures. The dev process explicitly targets the local Supabase URL with keys blank. No bank details, payments, uploads, invitations or database/Auth/Storage writes are submitted. Fixtures are removed before release; viewport and appearance are restored.
- Owner's separate earnings, enterprise-doc, PWA, media and build-cache work remains excluded.

## Verification

- `node scripts/test-phase5-provider-workspaces.mjs`: four actual pages rendered with isolated backend mocks; owner/member and approval guards; private/pending/rejected/verified profile states; anchor/checklist semantics; masked history and missing dates. An in-memory payout-handler fixture verifies the async form reset and that opening disable confirmation sends no DELETE.
- Provider, instructor authoring, learner account/library and Home regression suites passed. The production build, including TypeScript, passed.
- Browser: 320/375px mobile, 768px tablet and desktop, light/dark, organization filtering/no-match, provider character counts, accessible image-control names, member/recipient confirmation opening and cancellation. No page-wide overflow in checked layouts.
- Known baseline lint error: the invitation form's existing session-storage feedback effect triggers `react-hooks/set-state-in-effect`; signed provider images also trigger three existing raw-image warnings. The effect behavior is unchanged; focused lint with that existing rule excluded reports no other errors. No lint configuration was weakened.

## Resume here

Company workspace, billing, reports and insights are completed in the [company checkpoint](phase5-company-workspaces.md). Next: admin-review screens. Instructor Earnings still needs review against the owner's separate changes before editing or releasing that screen. Notifications and Live payment activation remain separate work. Phase 5 is not yet complete.
