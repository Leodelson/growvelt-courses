# Old-www compatibility and joint cutover review

Local preparation, 2026-10-17. **Not permission to push, deploy or transfer domains.**
Careers currently serves both jobs and www, with canonicals/sitemap still on www.
Learning remains on learn. No hosted settings, provider endpoints, DNS, Search
Console, customer data, Careers code or Docker resources were changed here.

## Local compatibility contract

Applies only when the explicitly configured Learning origin is www, Careers origin
is exactly `https://jobs.growvelt.com`, the explicit build-time switch
`NEXT_PUBLIC_LEARNING_DOMAIN_CUTOVER_ENABLED=true` is enabled, and the incoming hostname is www.
Current/default mode, learn, www.learn, jobs and preview origins are not intercepted.
The former 503 sentinel has been replaced; these are deliberate user-facing responses.

| Original www request | Prepared behavior |
| --- | --- |
| GET/HEAD `/dashboard`, `/dashboard/profile`, `/dashboard/settings` | Temporary 302 to the same path at jobs. Query discarded; fixed `#careers-moved` fragment prevents inherited hash tokens (Next normalizes away an empty fragment). No cookies forwarded by application code. |
| POST/other unsafe methods on those paths (including stale server actions) | 409 `careers_moved`, no Location, no body read/replay, no Auth/data/provider access. |
| GET/HEAD `/auth/callback` or `/auth/reset` | 200 no-store restart page; no Careers or Learning code exchange. Clear query/hash from current history entry with CSP-hashed script. Link to jobs `/auth?mode=signin`; request fresh recovery email there when necessary. |
| GET/HEAD `/auth`, `/auth/forgot-password` | Same restart guidance; no new old-origin Careers sign-in initiated. |
| POST `/api/auth/welcome`, `/api/newsletter/subscribe` | 409 JSON (`success:false`, `retryable:false`, explicit jobs sign-in URL). User must resubmit on Careers; never claim success, transfer an email/address/body, or insert into Learning. GET/HEAD returns 405. |
| GET/HEAD `/jobs`, `/career-assistant`, `/dashboard/my-jobs`, `/dashboard/applications` | Exact verified installed-app shortcut paths: same temporary jobs redirect. Not a blanket `/dashboard/*` redirect. |
| GET/HEAD `/jobs/[id]`, `/companies/[id]` | Temporary path-preserving jobs redirect only for ONE ASCII segment, 1–128 characters, first alphanumeric and remaining alphanumeric/underscore/hyphen. This validates URL syntax, not record existence. No decoding or `/apply` catch-all; discard query and replace fragment with `#careers-moved`. |
| GET/HEAD `/employers`, `/updates`, `/get-started` | Reviewed public sitemap pages with no Learning page/handler ownership: same exact-path temporary jobs redirect. Other methods return 409 without replay. |
| `/pwa/launch.html`, `/offline.html` | Careers-moved page with jobs link, sign-in/reinstall/reconnect instructions and separate learn link. |
| `/sw.js` | Non-redirecting JavaScript at the ORIGINAL worker URL, root scope allowed, private/no-store. New install skips waiting and claims clients; no automatic tab navigation. |
| `/manifest.webmanifest` | Old Careers identity `/`, root scope, launch URL `/pwa/launch.html`; explicit moved name, no attempt to make a cross-origin manifest identity. |
| `/site.webmanifest` | Future Learning manifest gets distinct id `/learning/`, root start URL. Old learn manifest unchanged. |
| `/` | Learning homepage, not a Careers redirect; existing Careers navigation link points to jobs in future mode. |
| Learning namespaced aliases, other Learning dashboard routes, Auth/payment/webhooks | Existing Learning implementation; untouched by compatibility handlers. |

For `/jobs`, old search query `q` is deliberately dropped with other query data;
users can repeat the search at jobs. No arbitrary filter/token query forwarding.
The root worker's offline migration screen is deliberately generic; online public
detail routes go through the network and receive the path-preserving redirect.

### Careers route-contract review delta

Read-only input: `C:/Users/HP/Projects/job-website/docs/careers-legacy-www-route-contract.md`.
The dynamic public-detail redirects above close the identified indexed-link gap.
Tests exclude `/jobs/[id]/apply` and nested questions/preview/success steps,
private company subpaths, malformed/encoded/oversized IDs, referral/unsubscribe
families and `/api/paystack/verify`. These excluded routes currently fall through
to Learning's 404, NOT a completed migration UX. They remain release blockers:

- application steps: agree a no-input-transfer restart page linking to the public
  jobs detail; preserve in-flight applications on Careers during the drain;
- private deep links: inventory and agree explicit new-session entry paths;
- referrals: decide validated code/path handling and prove jobs-origin attribution;
- unsubscribe/alerts and their side-effectful GET APIs: Careers must provide a
  completion mechanism and update senders without generic token forwarding;
- Careers payments: its own authenticated receiver, original transactions and
  callbacks require an owner-approved retention/reconciliation plan, never replay;
- old newsletter/support action links: classify their exact destinations; no
  generic private API/admin fallback. New local Learning routes must not later
  reuse these reserved paths without rerunning the contract/isolation tests.

### Already-delivered email logo retention

Keep exactly `/logo/growvelt-magenta-email.png` readable on future www during grace.
Learning already owns the identical approved PNG at this exact path; read-only
comparison with Careers produced SHA-256
`d91eb40371a73cf24f4b8f14804d4bb5ee7da2336507278caf2673590c81ea3a`
for both files. No asset copy, proxy, private API or database access is required.
The future HTTP rehearsal checks 200, PNG content type and that exact byte hash.
Freeze this public path through the retention period, even if later branding moves
elsewhere. Other historic logos need a separate explicit asset inventory; no blanket
`/logo/*` proxy. Old private/action links are not made safe by preserving an image.

All compatibility responses are no-store, no-referrer, noindex/nofollow and nosniff.
HTML is self-contained, keyboard accessible and responsive, contains no user input,
and permits only a hashed inline recovery/update script. No foreign CORS access,
shared Domain cookie, access-token handoff, proxy-to-Careers or extra Supabase client.

### Auth interruption policy (must be approved)

Before transfer, Careers must continue handling its own original-origin in-flight
flows while directing new flows to jobs. After transfer, an old-www Careers link
**does not finish sign-in/reset automatically**: its user restarts at jobs. This is
the safe-restart policy Careers proposed, not zero-interruption Auth migration.
Learning never possesses Careers credentials, so it cannot safely finish Careers
PKCE under the separation requirement. If seamless old-www completion becomes a
requirement, STOP: a separately reviewed same-origin Careers compatibility service
is needed before transfer. Do not forward codes, recovery fragments or cookies.

### Installed-app lifecycle and limits

Verified read-only Careers source: `/sw.js`, root scope `/`, `updateViaCache:none`;
cache-first `/pwa/launch.html`; worker cache `growvelt-pwa-v16`; manifest id `/`,
start URL `/pwa/launch.html`, scope `/`. Its push can target old Careers paths.
Careers' subsequent history review reports the same `/sw.js` URL and cache family
from v1 through v16, with historical start URLs `/`, `/dashboard` and the current
launch page. Root and dashboard behavior are explicitly covered by this contract;
this supplied history does not replace actual iOS/Android install testing.
The replacement worker embeds a migration page for offline use, intercepting only
GET navigations to the exact verified legacy pages/launch/offline paths. It does
not intercept Learning root/aliases, Auth, APIs, payments, assets or foreign origins.
Activation deletes only disposable caches matching `^growvelt-pwa-v[0-9]+$`, never
Auth cookies, localStorage, IndexedDB, unrelated caches or registrations. It does
not unregister itself or overwrite a jobs-origin installation. Retain this original
worker endpoint for late-returning devices; do not replace it with a 301/404/HTML.

Legacy pushes show fixed migration guidance only; notification clicks open jobs
dashboard, ignoring old payload paths/tokens. No old push subscription is copied to
Learning or jobs. Careers owns retiring old-www subscriptions and asking permission/
registering new subscriptions at jobs. This sender-side process needs Careers review.

Offline devices that never obtained the replacement still have the old worker until
they reconnect and an update succeeds. Previously installed versions with start URL
`/` are indistinguishable from ordinary Learning root visits: do not redirect all
root visits or guess by user-agent/cookie. They use the visible Careers link and
reinstall at jobs. Unknown historical worker URLs/scopes or additional shortcuts
must be supplied by Careers; this implementation covers the verified root worker,
not an invented inventory. New jobs app identity is a separate installation.
Do not register a new Learning worker over the root scope during this compatibility
period unless it retains this migration contract; the untracked PWA files are not
part of this release. Manifest identity separation does not create separate root
worker registrations on the same origin.

Worker lifecycle/identity rationale: [skipWaiting](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting),
[clients.claim](https://developer.mozilla.org/en-US/docs/Web/API/Clients/claim),
[manifest id](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/id).

## Reproducible tests

No `.env.local` overrides, hosted writes, emails, purchases or secret reads are needed.
HTTP runners blank backend URLs/keys and email/payment/gate settings before dotenv.
Temporary servers bind loopback and are stopped after tests. Browser tests use a
disposable headless profile and local synthetic data, never the user's installation.

```powershell
node scripts/test-careers-compatibility.mjs
node scripts/test-learning-domain-transition.mjs
node scripts/test-learning-domain-transition-http.mjs future --compatibility
node scripts/test-learning-domain-transition-http.mjs legacy
node scripts/test-careers-pwa-browser.mjs --playwright-module "<installed-playwright-module>" --browser-executable "<installed-chrome-executable>"
```

The future HTTP harness gives real Next requests the www hostname while binding
only loopback (no production trustHostHeader/DNS changes). It verifies routing and
static-file interception before filesystem routes. The browser test models v16's
cache-first old launch, then runs the actual generated replacement worker and HTML.
It is a real browser lifecycle test, not evidence that a user's installed mobile app,
Careers hosted login, new jobs installation or live push provider was tested.

### Verified local result — 2026-10-17

| Check | Result |
| --- | --- |
| Compatibility unit suite: all methods, body/cookie isolation, token-free restart, manifests, worker/push doubles | PASS |
| Existing Learning domain suite: original-origin PKCE, aliases/cookies, strict payment guards, templates, SEO | PASS |
| Optimized future build + real www-hostname Next HTTP rehearsal | PASS, including normalized fragment protection and direct Careers reset routes |
| Optimized default/legacy build + loopback HTTP rehearsal | PASS |
| Real disposable Chromium lifecycle: old cached offline launch, reconnect/update, offline migration, unrelated cache/cookie/storage retention, Auth token stripping, fresh launch and 360px layout | PASS |
| Existing Learning Auth-session and Paystack configuration regressions | PASS; existing Node module-type warnings only |
| Targeted compatibility/domain lint | PASS |
| Latest-source TypeScript (`--noEmit --incremental false`) | PASS |

The route-contract delta reruns the compatibility/domain suites, future optimized
HTTP rehearsal (GET and HEAD details, non-replayed methods, excluded private/token
paths, exact static email-logo bytes), real-browser redirect-fragment/referrer
checks with a loopback mirror of the validated jobs destination, and targeted
lint/TypeScript. External navigation was blocked by this browser environment;
the test validates the actual jobs Location header then rewrites only the fixture
response to its local mock destination. No live destination is contacted and no
network restriction is disabled.

The bundled Playwright package had no downloaded Chromium binary; the browser test
used already-installed Chrome headlessly with a fresh disposable context instead.
Nothing was installed. Earlier test iterations exposed an activation-state wait,
a fixture charset issue and Next normalizing an empty redirect fragment; these were
fixed and the final suites above passed. No assertion was weakened to accept token
forwarding or backend calls. Safari/iOS installation, actual jobs hosted login/push,
Careers rollback-worker activation and unknown historical workers remain joint
preflight work, not results claimed by this local test.
The contract and this runbook were sent to Careers chat **Confirm repository origin**
for planning-only review. Delivery is not approval, and no live action was requested.

## Exact proposed joint cutover sequence — requires approval

Do these in order; stop on a failed gate. Do not perform any of them from this local
task. Name Careers, Learning, Vercel/DNS and rollback operators and record a shared log.

1. **Freeze and snapshot.** Record both immutable ready deploy IDs, host assignments,
   DNS/TTLs, each product's URL env/build values, Auth Site URL+allowlists+templates,
   Google/Turnstile settings, payment callbacks/webhooks, PWA manifest/worker URLs
   and sender subscriptions. No secret values in the handoff. Exclude unrelated
   Careers security/application-form and Learning dirty/PWA files from release.
2. **Resolve ownership before any transfer.** Careers signs off on the contract
   above, the safe Auth restart policy, finite legacy route inventory (including
   all other Careers public/API/payment links), worker/cache ownership, old pushes,
   privacy/retention, monitoring and rollback worker. Explicitly resolve apex
   `growvelt.com`: it is NOT automatically transferred with www. Unknown old route
   families are a release blocker, not permission to blanket-forward bodies or codes.
3. **Prove parallel Careers.** While www still serves Careers, Careers' owner tests
   jobs HTTPS, separate Careers Supabase signup/login/reset/OAuth, roles, public
   routes, provider callbacks, fresh PWA/install/push in its approved test workflow.
   Additive jobs Auth entries remain; original www entries stay for grace. Announce
   the jobs address/reinstall guidance. No Learning Auth allowlist entry for jobs.
4. **Move new Careers flows first.** After explicit approval, Careers deploys its
   jobs canonical/server/email URL settings and changes its own Site URL to jobs,
   keeping original www allowlist and original-origin handling for outstanding flows.
   Validate jobs canonicals, sitemap and actual links. www remains Careers during
   the measured Auth drain; the owner chooses/logs a drain threshold from actual
   link expiry/traffic, not an arbitrary assumed number of hours. Careers payment
   endpoints are its own task and must be preserved/verified, not changed by Learning.
5. **Stage Learning without moving learn.** Review and build the future-www version
   with Learning origin www, Careers origin jobs and the explicit cutover switch
   enabled ONLY for that separately approved future deployment, never the
   preparation-only release. Keep the known-good legacy
   Learning deployment available and pin learn/www.learn/courses aliases to their
   existing behavior. Confirm Vercel can assign www to the reviewed immutable future
   deployment WITHOUT promoting/repointing all Learning production aliases. If the
   platform workflow cannot isolate this, STOP and review a dual-host release first;
   do not promote future canonical/redirect settings onto learn speculatively.
6. **Transfer only www in the window.** After Careers drain and go/no-go approval,
   move www assignment to that staged Learning deployment. Preserve www TLS and
   jobs/learn assignments. Do not change apex or DNS unless the approved exact
   ownership plan explicitly requires it. Confirm old-www worker/launch/Auth/POST
   compatibility and new Learning aliases over HTTPS before advertising new login.
   During the non-atomic settings window, direct users to the still-working learn
   site and do not start new www Learning Auth/payment flows until preflight passes.
7. **Configure Learning Auth only after www serves Learning.** In
   `qtcpjcaoptdunuefwvgc`, add exact www `/auth/learning/callback` redirect URLs and
   required tested query variants for dashboard/teach/recovery; retain all original
   learn entries. Keep Google provider callback on this same Learning Supabase
   project. Verify Google/Turnstile permitted www host; save reviewed Learning-only
   email templates. Change Learning Site URL to www in the approved window. New
   www and old learn sign-in/recovery must both pass before opening new www flows.
8. **Keep payments on learn initially.** A www website launch does not require an
   immediate payment endpoint move: retain the recorded working learn callback and
   non-redirecting webhook, modes/keys/gates/reference checks. Future code accepts
   both approved callbacks. Only with separate payment approval/test evidence later,
   move the configured callback/webhook to www while retaining learn for old checkout
   references and provider retries. Never enable live mode as a side effect.
9. **Verify then release.** Verify learner/instructor/admin access, original Learn
   PKCE/recovery and old GL/CP/GS callbacks, webhook idempotency, new www namespaced
   Auth/POST/dashboard routes, old-www restart/409/shortcuts, old-worker online/offline
   update and new jobs PWA/push. Use approved synthetic accounts/provider test mode,
   not destructive customer-data tests. Monitor errors, pending payments and old paths.
10. **SEO and retirement only later.** Inspect each product's canonical/sitemap/
    robots/links but submit no Learning SEO from this preparation. After joint live
    acceptance and explicit SEO approval, each owner submits only its own sitemap.
    Do not use a blanket old-www-to-jobs redirect or whole-www Search Console move:
    www root intentionally becomes Learning. Keep learn Auth/payment routes and
    original worker compatibility through agreed grace; only then review individual
    GET redirects/allowlist retirement. Permanent redirects are not the first step.

## Rollback sequence

1. Declare rollback; stop advertising/starting new www Learning flows. Keep jobs and
   learn online. Never reset/reimport DBs, change keys, revoke users, replay POSTs or
   blanket-clear browser storage. Preserve provider queues and transaction references.
2. If www has NOT transferred, leave it on Careers. Restore only the failed reviewed
   Careers deploy/URL settings; keep additive jobs settings if jobs still works.
   There is no reason to alter Learning or DNS in this case.
3. If www HAS transferred, first move new Learning entry links and its Site URL back
   to learn and pin the previous learn deployment. Keep the staged www Learning
   deployment available during an explicit drain of any www Learning PKCE/payment
   flows already started. Original-origin flows cannot be moved by DNS magic.
   Keep its exact www callback allowlist until drain policy is signed off. A rollback
   that cannot wait accepts explicit safe-restart guidance, never cross-project code
   exchange. Any newly moved www payment endpoint requires a retained Learning-owned
   receiver or provider-approved queue/retry plan before www changes owners again.
4. Reassign www to the recorded Careers rollback deployment only after that drain/
   exception is approved. Jobs remains online and its Careers data/Auth remains the
   same project. Careers can keep jobs as canonical/Site URL while restoring www as
   a compatibility address; do not blindly roll every setting back to www or break
   new jobs sessions. Restore only settings/assignments the incident requires.
5. **Worker rollback is not a Git-only rollback.** Devices can retain the installed
   transition worker. The rollback Careers deployment must serve reviewed update
   bytes at the SAME `/sw.js` URL with no-store and a tested activation path. Until
   a device receives it, the installed transition worker safely continues to show
   jobs migration guidance for legacy launches; it does not become the original
   Careers app automatically. Jobs remains the escape route. Do not delete workers,
   clear storage or restore an old worker without testing active/waiting clients.
6. Verify Careers/jobs and Learning/learn, original callbacks/queues, worker updates
   and duplicate-event reconciliation. Revert only recorded DNS records if actually
   changed. Log residual in-flight retries and clients awaiting updates. Remove no
   Auth entries/endpoints or compatibility resources until the rollback is stable.

## Release review still required

Local behavior is reviewable, not live sign-off. Careers owns acceptance of the
extra exact shortcut/Auth paths, actual historical PWA versions, sender-side push
retirement, full legacy public/payment inventory and a rollback-compatible worker.
Both owners must approve the no-seamless-PKCE policy and prove hosted integration
with approved test users/provider mode before scheduling. No credentials, cookies,
users, databases or PWA identities are shared between the two products.
