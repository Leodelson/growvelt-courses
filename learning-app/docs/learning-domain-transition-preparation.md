# Local Learning cutover preparation — awaiting coordinated approval

Prepared 2026-10-16; verification completed 2026-10-17 (Africa/Lagos).
Production baseline remains `35021b7` on `learn.growvelt.com`.
Release follow-up (2026-10-18): the owner approved an isolated preparation-only
push with current learn defaults retained; see `learning-domain-preparation-release.md`.
The original scope below describes the pre-release local checkpoint, not permission
to activate future-www settings or transfer domains.
This supplements the earlier read-only `learning-domain-transition-audit.md`.
The seven exact collisions below supersede the audit's speculative route-family map.

## Scope and current state

- All changes are **local and uncommitted**. No push, deployment, domain transfer,
  DNS change, hosted Auth/email/payment setting change, database write or Docker action.
- Careers/user-confirmed status, updated 2026-10-17: the exact hostname is
  `https://jobs.growvelt.com` (with **w**), additively attached to `growvelt-jobs`.
  The Namecheap CNAME is configured, Vercel reports Valid Configuration, and its
  HTTPS Careers homepage works. These are supplied Careers observations, not new
  live checks or changes by Learning. `www.growvelt.com` still serves Careers;
  no www transfer has happened.
- Careers Supabase retains its six original redirect entries and now has the two
  correct jobs entries: `https://jobs.growvelt.com/auth/callback` and
  `https://jobs.growvelt.com/auth/reset`, as reported in the Careers chat.
  Its Site URL remains `https://www.growvelt.com`. These are **Careers-only**
  settings; do not copy them into Learning's allowlist.
- Keep Learning Supabase `qtcpjcaoptdunuefwvgc`, its credentials/users/cookies,
  databases, Storage, courses, progress, entitlements and financial records separate.
- `.env.local` was not changed. Current production defaults remain `learn`.
- Local PWA files and other pre-existing dirty/untracked work remain untouched.

## Exact ownership proposal (not activated)

| Colliding historical path on `www` | Proposed ownership after cutover | Learning's prepared destination |
| --- | --- | --- |
| `/` | Learning homepage; prominent Careers link to jobs. Historical Careers home changes intentionally. | `/` |
| `/dashboard` | Reserve old www URL for Careers compatibility | `/learning/dashboard` |
| `/dashboard/profile` | Reserve old www URL for Careers compatibility | `/learning/dashboard/profile` |
| `/dashboard/settings` | Reserve old www URL for Careers compatibility | `/learning/dashboard/settings` |
| GET `/auth/callback` | Reserve old www callback for Careers' original-origin compatibility/drain | `/auth/learning/callback` |
| POST `/api/auth/welcome` | Reserve old www endpoint for Careers compatibility; never process in Learning | POST `/api/learning/auth/welcome` |
| POST `/api/newsletter/subscribe` | Reserve old www endpoint for Careers compatibility; never insert into Learning | POST `/api/learning/newsletter/subscribe` |

Only these exact Learning paths are remapped. No blanket `/dashboard/*`, `/auth/*`
or `/api/*` forwarding. All non-colliding existing Learning routes remain where
they are. New dashboard aliases use internal rewrites to the existing protected
pages, preserving the original same-origin request, query string, role checks,
layout and cookie propagation. Nav links, recovery links and server redirects
map the three collision paths in cutover mode.

**The initial 503 sentinel has been replaced locally** by temporary jobs dashboard
redirects, token-free Auth/recovery restart pages, non-replayed 409 POST responses
and a root-worker/old-PWA migration path. All execute before Learning Auth/database
access. Exact behaviors, additional verified Careers shortcut/reset paths, tests,
limitations and the joint cutover/rollback order are in
`learning-careers-compatibility-runbook.md` (2026-10-17).

Careers proposed safe restart rather than seamless old-origin PKCE after transfer.
That experience and the added route/PWA contract still require joint release
acceptance. No codes, cookies, POST bodies or next parameters are forwarded to jobs.
No compatibility behavior is activated live; jobs HTTPS alone is not cutover approval.

The subsequent Careers route-contract review also adds single-segment public
`/jobs/[id]` and `/companies/[id]` redirects and exact `/employers`, `/updates`,
`/get-started` redirects. The runbook records ID validation, excluded private/token
paths, dropped queries, and byte-identical old email-logo retention. Application,
referral, unsubscribe, private action and Careers payment-link completion remains
an explicit joint release blocker; no generic API or token forwarding was added.

## URL configuration and defaults

`app/lib/site-urls.mjs` centralizes exact origins and the six path mappings.
`site-urls.d.mts` provides TypeScript declarations; no compiler-wide module changes.

| Setting | Default/required future value |
| --- | --- |
| `NEXT_PUBLIC_LEARNING_SITE_URL` | Unset defaults to `https://learn.growvelt.com`; future value `https://www.growvelt.com` |
| `NEXT_PUBLIC_CAREERS_SITE_URL` | Unset defaults to current Careers `https://www.growvelt.com`; future value must be `https://jobs.growvelt.com` |
| `NEXT_PUBLIC_LEARNING_DOMAIN_CUTOVER_ENABLED` | Unset/off for preparation. Explicit `true` required with both future URLs at the separately approved cutover. |

These are **build-time** public settings and require a reviewed build when changed.
They are documented as comments in `.env.example`, not enabled in `.env.local`.
Only approved HTTPS origins are accepted. Paths, credentials, query/fragment,
foreign domains and non-default ports are rejected for site origins. Future
Learning mode without explicit jobs configuration fails rather than self-linking
to the new Learning homepage. This does not itself validate jobs DNS/readiness.

Careers links in public/header/footer/dashboard/welcome/certificate content now
use the Careers origin helper; existing default links continue to Careers on www.
Learning metadata, OG/JSON-LD, sitemap, robots, certificate QR generation and app
email logo/footer use the Learning origin helper. New private dashboard aliases
are also disallowed in robots and inherit the existing dashboard noindex metadata.

## Auth and session compatibility

- Signup, Google sign-in and password recovery use a single callback URL builder.
- An action initiated on `learn.growvelt.com` always returns to its existing
  `/auth/callback`, even when the canonical config is future-www. It does not
  bounce the PKCE code across origins. The www.learn alias retains old-path behavior.
- In future mode, new www actions return to `/auth/learning/callback`. The alias
  calls the existing Learning exchange handler, using Learning's cookies/credentials
  only and the same original-origin no-store response. Recovery remains same-origin.
- Safe-next validation accepts only the known alias destinations and existing
  relative allowlist; rejects foreign/protocol-relative URLs and path traversal.
- No shared Domain cookie, token URL handoff, key swap, account import or global
  signout. Existing Learning users normally sign in once on www with their same
  Learning account; old learn sessions remain usable during grace.
- Do not domain-redirect all learn traffic. Retain original-origin callback/error,
  recovery/reset, old POST API and payment/webhook paths throughout the grace period.

## Payment compatibility

`PAYSTACK_CALLBACK_URL` remains independent of canonical/SEO configuration: this
preparation does not automatically change its value, modes, credentials or gates.
In current/default mode, the Live callback guard still accepts only the exact learn
origin/path. In explicit future mode it accepts the exact www callback **and** the
old learn callback for grace, rejecting jobs, foreign hosts, other paths, HTTP,
credential-bearing URLs, fragments and non-default ports.

No change to course/company/subscription reference generation or confirmation,
signature verification, same-origin protections, idempotency or existing records.
`/payments/paystack/callback` and `/api/payments/paystack/webhook` are not among
the supplied collisions and remain unchanged. Keep the old learn webhook receiver
non-redirecting for retries and old transactions; retain GL-/CP-/GS- references.
No Live payment activation is part of a domain transition.

## Email preparation

All 13 **local** Supabase Auth HTML templates use `{{ .SiteURL }}` for logo/footer
links instead of a hard-coded learn host. All existing auth variables, action URLs,
content and other links are preserved byte-for-byte except those substitutions
(line-ending normalization excluded); this is asserted against the baseline in tests.
The current hosted templates have not been edited or uploaded. At approval, compare
and save only in the verified Learning project, preserve its configured Site URL
during the initial template step, then change Site URL in the coordinated window.

Application email logo/footer comes from the approved canonical origin, not an
untrusted request/base URL. Existing invitation/action URLs remain original-origin
where generated by the current request-based flow, preserving grace-period access.
Historic emails and QR links require old learn URLs to remain operational. No email
send/resend, recipient change, SMTP/MX/SPF/DKIM/DMARC change is involved.

## Local tests and safety

`scripts/test-learning-domain-transition.mjs` uses real source transpilation with
mocked Auth/network effects and synthetic requests. It tests:

- default/future origins, invalid host/port/userinfo rejection and Careers isolation;
- exact collision classification, suffix/query/fragment preservation and no broad remap;
- all three dashboard alias rewrites, session-cookie propagation and no Domain sharing;
- jobs GET redirects, Auth restart and 409/no-forward POST behavior before any Auth call;
- original learn PKCE completion on learn and namespaced www completion on www;
- safe next paths, rendered profile-link mapping, Paystack strict guards and unchanged references;
- actual app email escaping/URLs, robots, and all 13 Auth template-variable preservation checks.

`scripts/test-learning-domain-transition-http.mjs legacy|future` builds into separate
ignored `.next-domain-legacy` / `.next-domain-future` directories and runs a temporary
server bound to loopback. It explicitly blanks dotenv/backend URLs and keys, Resend,
Paystack, Turnstile/cron secrets and payment gates before Next loads `.env.local`.
No hosted or synthetic local Auth/DB/Storage writes are performed. Invalid newsletter
POSTs and cross-origin welcome POSTs are rejected before side effects. Missing-code
callbacks, protected aliases, homepage links/canonical, robots and sitemap are checked
over HTTP. The test server is stopped in finally. Normal `.next/dev` is not replaced.

An authenticated payment confirmation page cannot be meaningfully rendered with
the backend disabled; do not weaken the rehearsal to make that check pass. Payment
guard/reference/core behavior is unit-tested. A real end-to-end checkout and original
origin email flow still require an approved test environment, not a hosted production
write test or a new Supabase project.

Commands (from Learning root):

```powershell
node scripts/test-learning-domain-transition.mjs
node scripts/test-learning-domain-transition-http.mjs legacy
node scripts/test-learning-domain-transition-http.mjs future
node --experimental-strip-types scripts/test-auth-session-propagation.mjs
node --experimental-strip-types scripts/test-phase1b3a-live-config.mjs
node --experimental-strip-types scripts/test-phase4-subscription-checkout-core.mjs
node --experimental-strip-types scripts/test-phase4-subscription-management.mjs
```

### Verified results (2026-10-17)

| Check | Result |
| --- | --- |
| Migration-specific strict origins/collisions/Auth/cookies/payment/email/robots tests | PASS |
| Current/default configuration optimized build and loopback HTTP rehearsal | PASS |
| Future-www configuration optimized build and loopback HTTP rehearsal | PASS |
| Latest-source TypeScript `--noEmit --incremental false` | PASS |
| Existing Auth session, Paystack configuration, subscription checkout core and management tests | PASS |
| Existing Phase 5 UI fixture suites | 16 PASS; 1 stale public-support copy snapshot fails |
| Targeted lint for domain modules, proxy, alias handlers, Link adapter and new test runners | PASS |
| Expanded lint including legacy UI fixture loaders | 7 existing anonymous mock-component `react/display-name` errors; existing raw-image warnings |
| Whitespace check | PASS |

The public-support suite compares partnership copy against commit `2e4b537`, before
the previously approved wording changes. The current partnership file exactly
matches HEAD `35021b7`, is unchanged by this preparation, and differs from that old
snapshot. Do not revert user-approved copy to satisfy it. The older fixture loaders
were extended to resolve the new pure URL module; two exact root-link expectations
were adjusted for the URL helper's normalized trailing slash. Their pre-existing
anonymous component lint errors were not papered over or disabled.

No hosted end-to-end signup/recovery/purchase test was attempted. Auth exchanges,
session writes and payment provider responses in unit tests are synthetic mocks,
not production operations. Normal Next-generated type imports were restored to
the original `.next` directory after isolated rehearsals; explicit test build type
includes and ignored test directories remain for repeatable local testing.

`--skip-build` reuses an existing isolated build; HTTP canonical checks reject the
wrong mode. Test mode is not a deployment mode or a hosted environment setting.
The normal build directory and credentials must never be substituted into these tests.

## Settings needed at coordinated cutover — do not apply yet

1. Careers has confirmed working jobs DNS/HTTPS as of 2026-10-17; recheck during
   preflight rather than treating DNS configuration as still outstanding. www
   remains Careers until the agreed window. Agree old-www legacy callback/POST handling,
   Careers root worker/installed-PWA behavior, rollback owner and apex ownership.
2. Review local diff and approve the path ownership table and tested compatibility
   contract, including Auth restart and installed-PWA limitations, before any switch.
3. Vercel **Learning only**: future public URL settings above; approved www domain
   assignment and build. Leave Supabase keys, cron and payment gates unchanged.
   Keep learn, www.learn and both courses aliases with valid TLS.
4. Once www is owned/served by the prepared Learning deployment in the coordinated
   window, Learning Supabase Site URL becomes `https://www.growvelt.com`. Add only Learning
   `https://www.growvelt.com/auth/learning/callback` plus the needed exact query
   variants for `/learning/dashboard`, `/teach/apply` and `/reset-password`, testing
   actual Supabase matching. Retain the existing learn callback and approved dev/
   preview entries for grace. Do not allow www `/auth/callback` in Learning—it is
   reserved for Careers. Do not add jobs to Learning's Auth allowlist. Do not
   pre-authorize Learning callbacks on a hostname still serving Careers. Keep
   new-www login/checkout unavailable during any intermediate settings window;
   the original learn site remains the working access path until preflight passes.
5. Google provider callback stays
   `https://qtcpjcaoptdunuefwvgc.supabase.co/auth/v1/callback`. Verify Google origins/
   consent links and Turnstile permitted hostname cover www; keep original learn
   flows working. No broad wildcard or verification bypass.
6. Verify saved Auth templates on the Learning project; apply reviewed template
   changes only with separate approval. Mailbox/domain email DNS remains unchanged.
7. Snapshot actual Paystack Test/Live URLs. When approved, set new Learning
   `PAYSTACK_CALLBACK_URL=https://www.growvelt.com/payments/paystack/callback` and
   configure the Learning-owned webhook as appropriate, retaining the old learn
   non-redirecting receiver through grace. Do not change credentials/modes or charge.
8. Confirm new canonical/OG/JSON-LD, sitemap/robots and certificate URLs, then
   coordinate Search Console updates after the live switch—not during preparation.
9. Retain old learn pages or add explicit temporary GET/HEAD redirect mappings
   only after sensitive route exemptions and original-origin tests are approved.
   Postpone permanent redirects until rollback and outstanding flows are checked.

## Rollback and remaining gates

Record domain assignments, DNS, deploy commit, URL settings, Auth allowlist/templates
and payment endpoints before any live action. To roll back, restore the reviewed
deployment/settings/assignments together; keep original learn endpoints reachable,
preserve queued provider events and reconcile once. Never reset/reimport the
database or erase cookies/storage to roll back a URL change.

Remaining release gates: path ownership approval; Careers legacy handling and PWA
sign-off; cutover-time revalidation of confirmed jobs DNS/TLS; actual hosted settings snapshots; approved Auth/email/payment
end-to-end rehearsal; exact cutover window and operator/rollback coordination.
**Local preparation is not permission or readiness to switch production.**

## Hostname verification and Careers coordination (2026-10-17)

The local hostname review found no misspelled Careers destination in prepared
Learning source/configuration. `.env.example`, the URL helper, payment/Auth
isolation tests, HTTP rehearsal and read-only probe use `jobs.growvelt.com`.
The helper's current `www.growvelt.com` default is deliberate until coordinated
activation, not a spelling error. Existing Learn URLs remain deliberate grace
endpoints. Negative test fixtures for rejected misspellings are not destinations.
The domain-transition suite passed again after adding those rejection fixtures;
this update did not rerun the optimized builds or any hosted tests. The only local
environment files present are `.env.local` and `.env.example`: the former has no
transition URL overrides, and the latter keeps both future values commented out.

Planning-only coordination was sent to Careers chat **Confirm repository origin**
(`01a07fe7-0210-77c1-89c3-0723e7f2d140`). Its subsequent user-visible handoff proposed
old-www jobs guidance, safe Auth restart and a worker/launch compatibility path.
No change to Careers' project was requested here. Final release agreement remains
pending on the full contract in `learning-careers-compatibility-runbook.md`:

- exact old-www page GET/HEAD versus server-action POST handling for the three
  dashboard collisions; root `/` intentionally becomes Learning;
- outstanding original-www PKCE/recovery flows, without forwarding raw codes or
  sharing cookies, credentials, users or databases between products;
- the two legacy POST endpoints, which must never execute against Learning data;
- actual Careers worker URLs/scopes, manifest identity/start URL/scope, owned
  caches, push, offline/missed-update clients and old-www worker retirement;
- acceptance of the locally implemented replacement, grace/rollback owner and apex
  ownership. Do not schedule cutover or treat a message being sent as sign-off.

Do not globally clear browser storage, unregister unrelated workers, ship the
untracked Careers-style PWA files in Learning, or assume an installed www Careers
PWA can silently change origin to jobs. The final worker/migration contract must
be tested and approved with Careers before www is transferred.
