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

## Remaining Phase 6 work, in order

1. Resolve or document the upstream development-tool advisory and continue the
   role/API authorization, mutation-origin, input-abuse, and secret-boundary
   review, using isolated local fixtures.
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
