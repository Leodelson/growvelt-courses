# Learning launch hardening — 21 October 2026

The owner approved the Phase 5 visual result on 20 October and confirmed the
teaching application, lesson menus, certificate printing, mobile navigation,
subscription return notice, and management page behaved as expected. Phase 5
visual acceptance is closed. This supersedes the older Phase 5 status in the
14 October roadmap snapshot; it does not close earlier Live financial gates.

## First hardening slice

- Add `nosniff`, same-origin framing protection, and a restrictive cross-origin
  referrer policy through the existing Next configuration. Authentication,
  payment, and unsubscribe URLs use `no-referrer` to protect query values.
  Remove the framework-identification response header. No new runtime service
  or hosting plan is required.
- Preserve the approved profile layout while supplying its missing page
  heading to screen readers.
- Refresh stale regression fixtures for the 60 English FAQs, removed profile
  header navigation, Google One Tap dependency, approved About copy, and login
  activity in both Learning OAuth callback routes. Existing French/Spanish FAQ
  content remains at 10 answers each.
- Upgrade Next.js and its matching ESLint configuration to 16.3.8, sharp to
  0.35.5, and source-map-js to 1.2.2. Apply available compatible js-yaml and
  brace-expansion updates. Installation scripts were disabled for the update.
  The package lock records the resolved versions.

The initial runtime dependency audit reported a critical Next.js dependency
and two high-severity dependency paths. The updated runtime audit
(`npm audit --omit=dev --json`) reports zero advisories at this checkpoint.
That is the current advisory database result, not a complete application
security assessment. Maintainer advisories include
[Next.js ImageResponse](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j),
[Next.js Image Optimization](https://github.com/vercel/next.js/security/advisories/GHSA-cjq9-62q9-8jv4),
and [sharp's image dependency](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w).

The full audit still reports five high-severity development dependency paths:
`braces` → `micromatch` → `fast-glob` → `@next/eslint-plugin-next` →
`eslint-config-next`. The audit proposes a downgrade to Next's version 14
ESLint configuration; this is not applied to the version 16 application.
Review the upstream fix or an explicitly tested tooling replacement in the
next security pass. Do not describe the full dependency audit as clean.

## Verification

- Production build, including TypeScript.
- Focused ESLint: no errors; one existing raw provider-logo image warning.
- Nineteen Phase 5 presentation/database suites, including the three refreshed
  profile/home/support fixtures.
- Domain-origin/collision/callback/email checks and Auth cookie propagation.
- Paystack signature, callback reference, verified amount and ownership tests;
  Test/Live configuration and disabled checkout boundaries; subscription
  management and company commerce boundaries.
- Local PGlite communications ownership/RLS, opt-in audiences, support replies,
  notification, and status-transition checks.
- `npm run test:phase6:headers` against a local production server on port 4316:
  public FAQ/privacy pages, favicon, recovery page, both OAuth callback aliases,
  and invalid unsubscribe response. Callback and unsubscribe no-store behavior
  and all 60 English FAQ answers are included in these HTTP checks.

These checks do not send emails, sign in to a hosted user account, charge a
card, apply a hosted migration, or certify the production payment settings.

## Second hardening slice

- Stop treating `Sec-Fetch-Site: same-site` as an acceptable substitute for
  same-origin requests. Careers and Learning remain separate trust boundaries.
  Explicit origins must match the request origin, including on each retained
  Learning hostname. Header-less non-browser clients remain compatible and
  still require each protected route's authentication and permissions.
- Add the missing mutation-origin checks to company course assignments,
  public inquiries, newsletter subscription (including its Learning alias),
  and CAPTCHA verification. Validate positive workspace/course IDs and UUID
  assignees before assignment database access. Existing RPC permissions remain
  authoritative; origin validation does not grant access.
- Fix Help Assistant Messages getting stuck on Loading after clicking its
  already-selected tab. Fetch previews only while Messages is open, cancel
  on close, and refresh when reopened. Add initial/return focus, locally scoped
  Escape handling, linked tab/panel semantics, and Arrow/Home/End tab controls.
  The assistant remains non-modal and does not trap focus.

Verification for this slice:

- `npm run test:phase6:api`: execute 14 actual mutation handlers with mocked
  clients. Reject sibling/foreign requests before backend/provider access;
  check Email Center role denial, notification/preference ownership,
  assignment validation/permission denial, public form success, and signed-out
  denial. All three Learning origins have helper-level compatibility checks.
- `npm run test:phase6:assistant`: actual component with isolated hook/event
  fixtures for focus, Escape, tab keys/labels, repeated Messages clicks,
  reopening, and closed-panel fetch suppression. These are not browser or
  assistive-technology certification tests.
- Production build/TypeScript and focused ESLint passed. Domain compatibility,
  Auth session propagation, Paystack signature/amount/ownership, Help Assistant
  structure, and isolated PGlite communications/RLS suites passed again.
- Local production HTTP header/content/callback checks passed again, plus
  rejected sibling-origin POSTs to all four newly guarded routes and the
  newsletter alias. No successful hosted mutation or provider call was made.

The signed Paystack webhook and token-based unsubscribe confirmation were not
converted into browser-origin-only endpoints. No hosted Auth/payment settings,
database migrations, Careers files, or separately uncommitted PWA files changed.

## Third hardening slice

- Stream and cap public form JSON before parsing: newsletter 1 KiB (including
  the Learning alias), CAPTCHA verification 8 KiB, contact/partnership inquiry
  32 KiB. Check actual bytes, not just the declared length; reject unsupported
  content types (415), oversize bodies (413), and malformed JSON/UTF-8 (400).
  Cancel the reader on rejection and do not log request contents. Existing
  JSON clients, CAPTCHA actions, database permissions, and success messages
  stay unchanged. No paid service or hosted configuration is required.
- Remove eager preloading from the retained homepage photo, which now appears
  below the full-height motion opening. Keep responsive sizing and lazy image
  optimization. The approved opening and its motion/data-saver behavior stay
  unchanged.
- Add `test:phase6:json` for exact limits, absent/forged content lengths,
  streamed cancellation, and UTF-8 split across chunks. Extend actual-handler
  fixtures to assert that invalid/oversize requests never reach a database or
  provider. Production HTTP tests check rejection statuses for inquiries and
  both newsletter URLs. CAPTCHA rejection is tested with a fake secret/provider
  fixture, without contacting Cloudflare.
- Build/TypeScript, focused lint, API/assistant fixtures, homepage/opening/motion,
  domain transition, Auth session, and production HTTP header checks passed.

`test:phase6:public` checks six locally served production pages for HTTP 200,
one primary heading, main landmark, viewport, skip link, and image alt attributes.
On this machine the second full HTML GETs were 11–58 ms; decoded HTML was
34,780–68,437 bytes and estimated gzip HTML 7,383–14,659 bytes. These are local
HTTP/HTML baselines, not production timings or browser LCP/INP/CLS. No browser
script/image execution or complete accessibility audit is implied.

An Edge FAQ page was opened for interactive review, but target geometry/input
and screenshot capture were inconsistent during window switching. No interactive
accessibility sign-off was recorded. Keyboard/contrast/mobile overflow and
browser Web Vitals remain open. The current motion regression explicitly
preserves the previously approved button-free loop; its pause-control
accessibility requirement needs review rather than a claim of conformance.

Important remaining abuse gap: body/origin limits are not distributed rate
limiting. Public newsletter INSERT and inquiry RPC access still exist through
Supabase's public roles; direct API traffic bypasses app-route limits. Review
durable quotas and grants together before launch, rather than relying on an
in-memory per-instance counter. No hosted grants or migrations were changed.
The fourth slice below supersedes this accepted-record quota gap; it does not
add a per-attempt, CAPTCHA-provider, or DDoS limit.

## Fourth hardening slice — durable intake activation

Prepared `20261106000000_add_public_intake_quotas.sql`, with table-level guards
for direct newsletter INSERTs and inquiries through the existing public RPC.
Atomic fixed-window counters enforce proposed global/per-email accepted-volume
budgets. Existing records, grants and consent remain intact. Compatible app
handlers return friendly HTTP 429 responses and identical generic 202 responses
for new/existing newsletter addresses.

The isolated SQL tests passed migration/reapply/rollback, permissions, all quota
slots, timestamp spoofing, normalization, atomic rejection, and cleanup. After
the owner started Docker, the real local PostgreSQL test passed four concurrent
global/email hour/day races with observed lock waits and atomic rejected-counter
rollback. Its fresh disposable database was removed; the existing local database
was unchanged. Build/TypeScript, focused lint, API fixtures, public pages/headers,
and Auth/domain regressions also passed.

The owner subsequently approved the single hosted apply. Verified the explicit
Learning project and Ready Production deployment `146282a`, applied only this
file, passed the hosted read-only assertions, and recorded only this version
in migration history. Active function checksums match the tested file; both
intake record counts remained unchanged and no production fixture was submitted.
The homepage, Contact and FAQ pages returned HTTP 200. Hosted accepted-volume
quotas are now active; no Auth/payment, domain, Careers, or paid-service settings
changed. No application redeploy was needed for activation.
See [activation and rollback](phase6-public-intake-activation.md) for proposed
limits, privacy/retention details, residual public API risks, and exact steps.

## Fifth hardening slice — public navigation keyboard review, 22 October

Real in-app-browser checks against the local production FAQ reproduced two
issues: language arrow keys did nothing and Escape discarded focus onto the
document; Escape in the mobile Careers disclosure closed its parent drawer too.
The language globe also lost the global purple focus shadow through a more
specific CSS rule, leaving a nearly white outline against a white surface.

- Language menus now focus the saved option on opening, support Arrow Up/Down
  with wrap and Home/End, link trigger/listbox IDs, and return focus after
  selection or Escape. Leaving the control closes it without moving focus
  back from the user's next destination. Pointer dismissal supports touch.
- Careers Escape is scoped to its disclosure; one Escape closes the submenu,
  another closes the mobile drawer and restores its trigger. No destination
  links, Auth behavior, role permissions or approved layout changed.
- Explicit theme-aware purple focus outlines cover desktop/mobile language
  triggers and options without clipping the option indicator at the popup edge.
- `test:phase6:navigation` executes the actual components in isolated hook/event
  fixtures for both menu variants, saved selection, focus restoration, blur,
  arrow/Home/End keys, linked IDs, and nested Escape propagation.

Browser confirmation on the rebuilt production FAQ: desktop arrow/Home/End,
Enter selection and focus return; mobile language arrows/Escape; Careers
submenu-first Escape; drawer first/last Tab wrapping, scroll lock and cleanup.
At requested viewport widths 320 and 390 px there was no document horizontal
overflow (content widths 305 and 375 px with the browser's scrollbar). The
desktop focus outline resolved to purple `rgb(138, 4, 223)` against white,
and the reviewed tab had no captured console errors. This is a focused public
navigation review, not a complete screen-reader, contrast or signed-in audit.

Build/TypeScript, focused lint, navigation/assistant/API fixtures, existing
homepage/navigation regressions, local public/header HTTP checks and domain/Auth
regressions passed. Six local second HTML GETs were 6–12 ms in this run; these
remain local HTTP timings, not browser or production Web Vitals. Broader page
coverage, the approved motion loop's pause-control question, and real browser
LCP/INP/CLS remain open. No hosted settings, database or payment mutation was
performed for this slice; unrelated local PWA/email-template work was excluded.

## Remaining Phase 6 work, in order

1. Resolve or document the upstream development-tool advisory and continue the
   broader role/API authorization, input-abuse/rate-limit, and secret-boundary
   review beyond the tested handlers, using isolated local fixtures.
2. Perform keyboard, focus, contrast, mobile viewport, and page-performance
   checks on the current public and signed-in experiences. Record real results
   rather than treating the completed visual sign-off as an accessibility audit.
3. Verify production canonical/robots/sitemap and old-host behavior; review the
   separately uncommitted PWA work before considering it for release. Google
   One Tap's production prompt was deferred by the owner and is still pending
   confirmation.
4. Verify existing logging, email failure handling, incident steps and rollback
   deployment references using available free facilities.
5. Prepare the learner Live checkout activation checklist: merchant readiness,
   the correct HTTPS callback and webhook, isolated credentials and switches,
   ownership/amount verification, recovery/refund handling, and a separately
   approved controlled real purchase. Live activation is not implied by passing
   configuration unit tests.

Company paid learning still requires the agreed verified Live charge,
settlement batch, matching bank credit, locked seller release/reservation writer,
and final operational verification. Instructor payouts, company seller outflow,
and Live subscriptions retain their separate gates. No hosted payment/Auth,
DNS, database, or Careers changes are part of this slice.
