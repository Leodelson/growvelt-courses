# Phase 5 — Instructor Earnings and coverage checkpoint, 16 October 2026

## Earnings completed

`/dashboard/instructor/earnings` now has a responsive header, top workspace link, summary/history/guide shortcuts, six allocation-state cards, course/reference/terms search, status filtering, name sorting, reset/no-match feedback and expandable recorded-event timelines. A matching loading state is included. The payout-profile destination remains separate; no withdrawal or transfer action was added.

The pre-existing six copy-only edits were inspected before integration. Their dash-free wording style is retained with complete sentences and current read-only explanations. The original calculation still groups instructor gross allocations by status; reserved/paid cards now expose totals already calculated by the page. Recoverable allocation totals are explicitly distinguished from each entry's `recoverable_amount_minor`. No settlement, withdrawable-balance or payment-success claim is inferred from those totals.

The protected server page still checks `isApprovedInstructor()` and calls the same own-earnings reader. Rendering lives in a separate presentational component for backend-free testing. Its only data comes from those original earnings/events props. Original financial values, order references, terms, hold reasons and event associations are retained. Invalid dates have a display fallback instead of crashing rendering. Shared filter controls support EN/FR/ES; existing Earnings content remains English.

## Verification

- `test-phase5-instructor-earnings.mjs`: approved-instructor guard, reader failure/empty cases, all six state totals, exact recovery amount, associated timelines, section destinations, date fallbacks and shared controls.
- `test-phase1c2a-instructor-earnings-app.mjs`: existing own-reader/admin-RPC boundaries and no payout controls. The presentation assertion now follows the extracted component; the stale admin-copy assertion is updated to the previously shipped wording, retaining the explicit no-Live-transfer assertion.
- All nine Phase 5 suites (this earnings suite plus the eight existing UI suites), the earnings application-boundary suite, focused lint and the production build/TypeScript passed.
- Computer-use browser QA used the actual presentation component with synthetic records. The process explicitly targeted local Supabase (`http://127.0.0.1:54321`) with blank keys; no backend/Auth/Storage or payment write was executed. Checked 320/375px phones, 768px tablet and desktop, light/dark, Spanish shared controls, status search/reset/no-match and event expansion. Checked layouts had no page-wide horizontal overflow. Open event timelines survive filtering/reset. The temporary fixture is removed; viewport and original appearance are restored.
- Own-earnings reader, authorization, RPCs, migrations, payout gates and financial writers are unchanged. Unrelated enterprise-design notes, PWA, media and build-cache edits remain excluded. No Docker, hosted configuration, Careers or security-roadmap changes.

## Coverage audit and next order

The route inventory and Phase 5 checkpoint files were compared; this is a coverage audit, not a claim of a complete accessibility or launch audit.

| Group | Recorded position |
| --- | --- |
| Public Home/Teach/Explore, course details and ratings, FAQ/About/Contact/Partnerships | Implemented in their public/catalog checkpoints. |
| Learner library, subscriptions, Profile/Settings, Dashboard Home/shared navigation | Implemented in learner/account/Home checkpoints. |
| Instructor authoring/subscriptions, provider organizations/profiles/insights/payout profile, company workspaces | Implemented in instructor/provider/company checkpoints. Earnings is completed in this checkpoint. |
| Admin reviews and financial/operations pages | Implemented in admin review/operations checkpoints. |
| Authentication presentation | Next: Sign in, Create account, forgot/reset password, Check email and authentication-error notice. Existing branding is present, but these have not received the current Phase 5 presentation review. AuthFrame currently supplies a story h1 in addition to form/page headings; audit semantics as well as spacing. Preserve callbacks, `next`, onboarding intent, CAPTCHA and all auth handlers. |
| Shared recovery/loading/empty states and secondary public pages | Follow authentication: inspect existing RouteError/not-found/loading integration, teaching application/lesson/certificate flows, public company/certificates/provider/trust/legal/blog pages and legacy redirect aliases. Do not invent duplicate pages or alter policies as UI work. |
| Notifications, PWA/security/Live operational readiness | Not included in this UI slice. Notifications remain owner-excluded; Phase 6 and real-money activation require their own readiness work. |

Resume with the authentication presentation group. Phase 5 remains open; Phase 6 has not started.
