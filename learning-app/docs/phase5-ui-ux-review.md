# Phase 5 — UI/UX modernization

## First review: empty and sparse cards

Status: implemented locally; the owner has viewed the first slice and requested that dashboard expansion pause while Home, Explore, and Teach are upgraded. These changes have not been committed or deployed. This does not complete platform-wide modernization.

## Dashboard checkpoint — resume here

Only empty-state presentation was upgraded on the following routes. Populated content, forms, authorization, and payment behavior were not redesigned.

| Route | Integration file | Completed scope |
| --- | --- | --- |
| `/dashboard/my-learning` | `app/dashboard/my-learning/page.tsx` | Empty learning library |
| `/dashboard/certificates` | `app/dashboard/certificates/page.tsx` | Empty certificate library |
| `/dashboard/saved-courses` | `app/components/learning/saved-courses-list.tsx` | Empty saved courses |
| `/dashboard/subscriptions` | `app/dashboard/subscriptions/page.tsx` | Empty learner subscriptions |
| `/dashboard/instructor/subscriptions` | `app/dashboard/instructor/subscriptions/page.tsx` | Empty instructor plan list |
| `/dashboard/admin/enterprise-contracts` | `app/dashboard/admin/enterprise-contracts/page.tsx` | Empty Recorded agreements panel only |

Shared component: `app/components/ui/empty-state.tsx` and its CSS module. The dashboard shell, populated cards and headers, and remaining instructor/company/admin groups are still pending. Do not mark these six entire pages as fully modernized. The owner's separate earnings/PWA/media changes are outside this slice.

The public redesign's owner-authorized isolated release includes the shared component because the public catalog requires it, plus the shared body minimum-width correction. It does not include any of the six dashboard page integrations above or the temporary review route; those remain local.

The shared `EmptyState` component is used by My Learning, Certificates, Saved Courses, learner Subscriptions, instructor subscription plans, and the empty Enterprise Contracts register. It replaces inconsistent paragraph-only and short card treatments with balanced content, a decorative course-card illustration, clear heading hierarchy, and existing next-action links where appropriate. Page and section variants keep small administrative panels proportionate.

Cards adapt to their own available width with CSS container queries, including inside another panel on a wide screen. Long action labels use full-width buttons in narrow cards. The shared body minimum-width constraint was removed after visual QA reproduced horizontal scrolling on a 320px viewport with a scrollbar. Existing theme colors and translations are used; the illustration is decorative and hidden from assistive technology.

The existing data queries, empty/data conditions, error states, authorization, forms, and payment routes are unchanged. No fixture records or Supabase writes are required for visual review.

## Review and verification

- A local, development-only `/ui-review/phase5` route shows all six examples without authentication or backend calls. Its controls switch the example, language, appearance, and available card width. Keep this temporary review route out of the eventual feature commit; it returns 404 outside development.
- Browser checks covered 320, 375, 768, 1280, and 1440px viewports, light/dark appearance, longer French/Spanish copy, and a narrow nested admin card on a wide viewport. The tested layouts have no horizontal overflow or clipped headings; action links retain at least 46px height.
- Focused lint, TypeScript, and the production build are used to verify the integration. Local screenshots are saved in this chat's visualization directory.
- The owner has viewed these examples. Final acceptance and isolated production deployment remain pending. At the owner's request, the next review is the public Home, Explore, and Teach experience, documented in `phase5-public-experience-design.md`. Resume broader dashboard work after that review.

Phase 6 launch hardening and the earlier live-commerce operational gates remain separately recorded in the roadmap checkpoint.
