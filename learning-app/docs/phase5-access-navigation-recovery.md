# Phase 5 — mobile navigation, authentication and recovery, 16 October 2026

## Mobile navigation correction

The mobile drawer was inside the header's z-index 25 stacking context while the fixed bottom navigation used z-index 30. Its own higher z-index could not escape that context. The bottom bar stayed visible, repeated drawer destinations and obscured the end of the scrollable menu, including Log out.

- The bottom navigation is now hidden only while the modal drawer is open and returns on close. The drawer header layer is raised during that state.
- Drawer content has its own bounded scroll area; Log out is outside it in a fixed flex footer, above safe-area padding. It has the standard Lucide outline LogOut icon, not an image or sticker. The sign-out action itself is unchanged.
- The drawer contains the full existing role-appropriate destinations, including Home/Jobs and instructor courses/create/earnings, since the bottom bar is temporarily hidden. Admin, instructor, learner and combined-role drawers have unique navigation destinations. Role permissions and server guards are unchanged.
- Existing modal focus trapping, Escape/backdrop dismissal, inert background, focus restoration and desktop-resize cleanup remain intact. Notifications content and behavior were not changed.

## Authentication presentation

Sign in, Create account, forgot/reset password, Check email and authentication-error notices all use the updated AuthFrame. Existing approved branding and the existing side image remain. Scoped responsive styling updates the story, form card, mode tabs, intent options, notices and fields. The decorative story heading is now h2, leaving one page h1. A localized skip-to-form link targets the account form area. A group-level loading state is included.

AuthForm, password forms, CAPTCHA component, auth callback, redirect helpers, server auth and welcome logic are unchanged. `next`, teaching/learning intent, Google/password actions, field names, confirmation requirements, neutral recovery feedback and CAPTCHA checks are preserved. No signup, reset, password update or sign-out was submitted during QA.

## Shared states

- The shared RouteError panel and all eleven existing not-found panels use consistent responsive feedback styling. Original wording, access restrictions and recovery destinations are retained; no raw error object is displayed.
- Added loading states: auth group; admin group; company overview/billing/reports/insights; learner subscriptions; instructor organizations and payout profile. Shared placeholders announce loading and `aria-busy` without inventing data or granting access.
- Added error boundaries for admin, company and subscriptions, using the existing reset/recovery pattern. Existing more-specific boundaries remain.
- Certificate detail and public certificate-verification loading states now announce their status and busy state. Other existing skeleton layouts are retained. All loading files are checked for a busy/status contract or an existing shared wrapper.

## Verification and safety

- `scripts/test-phase5-auth-navigation-states.mjs`: four role-menu combinations, unique drawer destinations, hidden bottom bar, logout SVG, six auth pages with one h1, onboarding/fields/CAPTCHA contracts, all not-found panels and loading status contracts. All readers/verification functions are isolated mocks; no external requests or writes.
- All ten Phase 5 suites (this suite plus the prior nine), existing OAuth cookie/safe-redirect regression checks and the production build/TypeScript passed. Focused ESLint has no errors; the three existing signed-avatar raw-image warnings remain. The OAuth test also emits the pre-existing Node module-type warning; package settings are not changed to suppress it.
- Source comparison confirmed auth/password/CAPTCHA/callback sources are unchanged. TypeScript AST comparison confirmed the sign-out function is unchanged.
- Computer-use skill used with a process explicitly set to local Supabase (`http://127.0.0.1:54321`) and blank keys. Actual presentation/navigation components used synthetic role/account props. Checked admin, instructor, learner and combined menus, including 320×568 and 375×812; Log out was in the viewport and passed a hit-test with the bottom bar hidden. Lower admin links scroll into view. Keyboard wrapping, Escape focus restoration and desktop-resize scroll cleanup passed.
- Checked auth/recovery/loading presentation at 320px phone, 768px tablet and desktop, light/dark and longer Spanish shared text. Checked pages had no page-wide overflow. Password visibility toggled with empty fields; no credentials were entered. Original theme/viewport restored and temporary fixtures removed before release.
- No database/Auth/Storage writes, migrations, API modifications, payment flags, production environment changes, Docker or Careers/security-roadmap changes. Unrelated PWA/media/enterprise-design notes remain excluded. Only exact disposable Next-generated dev type caches were removed after verifying their generated-file headers.

## Resume here

Authentication presentation and this shared-state group are complete. Next: inspect the remaining secondary public pages and teaching/lesson/certificate presentation against the coverage inventory, preserving content, access and policy wording. Do not declare Phase 5 complete until that coverage pass is done. Notifications remain excluded; Phase 6 launch hardening and Live financial activation remain separate readiness work.
