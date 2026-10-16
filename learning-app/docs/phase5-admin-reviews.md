# Phase 5 — admin review workspaces, 16 October 2026

## Completed group

| Route | Upgrade |
| --- | --- |
| `/dashboard/admin` | Responsive eight-workspace directory with local search, group filters and name sorting. |
| `/dashboard/admin/instructors` | Balanced application queue, top back link, responsive metadata, safe date presentation; existing server search and pagination retained. |
| `/dashboard/admin/instructors/[userId]` | Application/decision section shortcuts, responsive details and decision panel, safe dates and existing recorded-decision state. |
| `/dashboard/admin/courses` | Matching moderation queue, back link, responsive metadata and safe dates; existing search/pagination retained. |
| `/dashboard/admin/courses/[courseId]` | Overview, rights, curriculum, module and decision shortcuts; readable lesson/quiz content and responsive decision panel. |
| `/dashboard/admin/providers` | Provider/contact search, submission/name sorting, organized application facts and review controls. Notes survive local filtering and sorting. |

The four existing instructor/course queue/detail loading states use the same scoped layout. Shared controls and new navigation copy support English, French and Spanish. Existing English-only provider/business content has not been represented as fully translated.

Provider approval/rejection now opens the shared confirmation dialog and shows pending feedback during submission. Rejection still requires at least ten characters. The note label explains that the provider can see its review note, matching the existing provider form. Outdated text claiming verification could never publish a profile was corrected to describe the existing public-provider rules; those rules were not changed.

## Safety and verification

- Existing admin/session/record guards, server readers, queue pagination, rights data, quiz answers and Test Mode-only course publication warnings remain intact. No expanded access or new API/SQL/migration is introduced.
- Source/AST comparison confirmed the instructor, course and provider asynchronous decision writers are unchanged. Only the provider's pre-submission presentation/confirmation flow changed. No actual review decisions were submitted for QA.
- `node scripts/test-phase5-admin-reviews.mjs` passed: all six actual pages with isolated backend mocks, EN/FR/ES rendering, dates, search/group/sort behavior, missing/empty/finalized states, record guards, curriculum anchors, quiz content and Test Mode warnings. All six prior Phase 5 regression suites, focused lint and the production build (including TypeScript) passed.
- Computer-use browser QA used temporary presentation-only fixtures with the process explicitly set to local Supabase (`http://127.0.0.1:54321`) and blank keys. Checked desktop, 768px tablet, 375px and 320px phones, light/dark themes and translated labels. Checked layouts had no page-wide horizontal overflow. Provider notes survived filtering; blank course-return notes were rejected; provider/course/instructor confirmation dialogs opened and were cancelled without submitting.
- Temporary fixtures were removed, the viewport override reset and original language/theme restored. No hosted or local database/Auth/Storage test writes, payment operations, environment changes, Docker changes, Careers changes or security-roadmap changes were performed. Unrelated owner work remains excluded.
- Only the exact disposable Next-generated development type-cache files were removed after verifying their generated-file headers; no source, database or persisted application data was removed for build recovery.

## Resume here

The remaining financial/operations admin group is completed in the [admin operations checkpoint](phase5-admin-operations.md). Next: Phase 5 coverage audit, including the owner's separate uncommitted Instructor Earnings work and remaining authentication/shared-state presentation. This does not complete Phase 5. Notifications and Live payment activation remain excluded and require separate authorization/readiness work.
