# Old-www compatibility and joint cutover review

Local preparation, 2026-10-17. **Not permission to push, deploy or transfer domains.**
Careers currently serves both jobs and www, with canonicals/sitemap still on www.
Learning remains on learn. No hosted settings, provider endpoints, DNS, Search
Console, customer data, Careers code or Docker resources were changed here.

## Local compatibility contract

The finite Careers policy applies to exact incoming www in either fully configured
future mode (Learning origin www, Careers origin exactly jobs, explicit cutover
switch true) OR the separately enabled server-only safety bridge below.
Current/default mode with both flags OFF, learn, www.learn, jobs and preview
origins are not intercepted. The bridge never activates the future Learning UI.
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
| GET/HEAD `/jobs/[id]/apply`, `/apply/preview`, `/apply/questions`, `/apply/success` | 200 no-store application restart page linking to the validated public jobs detail AND Careers `/dashboard/applications`. No answer/token transfer or automatic resubmission. Already-submitted users are told to check submitted history first. HEAD has no body; unsafe methods return 409. |
| Finite private Careers pages listed below | Temporary same-path GET/HEAD redirect to jobs, discarding query/fragment and requiring Careers' own session/role checks. No Learning authentication lookup or account transfer. Unsafe methods return 409. |
| GET/HEAD `/ref/[code]` | Single ASCII segment `[A-Za-z0-9_-]{1,128}`, case preserved, temporary same-path jobs redirect. Drop ALL query data, fixed fragment. Jobs stores its own referral attribution; Learning does not store/copy user data. |
| GET/HEAD `/unsubscribe`, `/alerts/unsubscribe` | Narrow reviewed selector exception: forward exactly ONE bounded token, or only for `/unsubscribe` ONE valid email of at most 254 characters, to the SAME jobs page. Drop unrelated parameters; reject duplicate selectors or token+email. Invalid selectors get token-free settings/support guidance, not a redirect. Never process unsubscribe or echo selectors in HTML/logs. |
| GET/HEAD `/unsubscribe-success` | Token-free temporary redirect to same jobs page; no unsubscribe is processed or newly claimed successful by Learning. |
| `/api/unsubscribe`, `/api/alerts/unsubscribe`, `/api/paystack/verify` | No processing/forwarding. GET/HEAD 405; unsafe methods 409 moved JSON, success:false, retryable:false. Payment message says DO NOT PAY AGAIN; sign in on jobs and contact Careers support with original receipt/reference if paid. |
| GET/HEAD `/get-started/results`, `/dashboard/post-job/preview`, `/post-job/success` | Restart respectively at jobs `/get-started`, `/dashboard/post-job`, `/dashboard/my-jobs`; discard draft/answers/reference/query/hash, fixed fragment. Other methods 409. |
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
2026-10-18 local follow-up implements Careers' explicit application/private,
referral, unsubscribe and payment no-replay decisions above. This follow-up is
**not pushed or deployed**. Live preparation remains e64ba73, cutover disabled.
Unknown application steps, private company subpaths, malformed/encoded/oversized
IDs and unreviewed APIs are NOT captured. No blanket token redirect is allowed.
No additional Learning page/API collisions were found; a regression test reserves
the new exact action paths against accidental Learning reuse. Remaining gates:

- application steps/private pages: local implementation follows Careers' proposed
  restart/reauthentication contract; Careers must review the exact inventory and
  complete actual old-mobile-install and in-flight application drain tests;
- referrals: synthetic local receiver covers attribution intent; Careers verifies
  its jobs-origin storage/signup behavior; no hosted signup is run by Learning;
- unsubscribe/alerts: the reviewed jobs pages/APIs remain Careers-owned; Careers
  verifies their completion behavior and updated senders with approved test data;
- Careers payments: its own authenticated receiver, original transactions and
  callbacks require an owner-approved retention/reconciliation plan, never replay;
- old newsletter/support: Careers reports finite admin/support paths and the
  exact shared email logo suffice for its shipped sources; no
  generic private API/admin fallback. New local Learning routes must not later
  reuse these reserved paths without rerunning the contract/isolation tests.

Selector details: token syntax `[A-Za-z0-9_-]{1,256}`; no decoding beyond normal
URLSearchParams parsing. Email uses an ASCII local part of at most 64 characters,
no leading/trailing/repeated dots and valid bounded DNS-style domain labels.
Case is preserved, destination is built with URLSearchParams, not concatenated
selector text. Exactly one token OR email occurrence is permitted. Both empty
and duplicate selector keys fail closed. No selector is read on the old API
routes or in unsafe request bodies. Auth callback codes/tokens are NEVER forwarded.

### Finite private page inventory (local follow-up)

Read-only evidence: Careers app-router page filenames, checked 2026-10-18.
These are exact paths, not prefix redirects:

- `/dashboard/saved`, `/dashboard/pricing`, `/dashboard/recruiter/pricing`,
  `/dashboard/post-job`, `/dashboard/post-job/preview`, `/dashboard/jobs`,
  `/dashboard/employer-verification`, `/dashboard/ambassador`, `/dashboard/alerts`.
- `/dashboard/admin/{updates,support,growth,employer-verifications,emails,ambassadors}`.
- `/career-assistant/job-seeker` and exact children
  `{saved-reports,resume,job-match,interview,cover-letter}`.
- `/career-assistant/employer` and exact children
  `{saved-outputs,job-description,interview-builder,candidate-screening,bias-evaluation}`.
- `/candidates/[id]` and `/dashboard/my-jobs/jobs/[id]`, using the same bounded
  ASCII single-segment syntax as public details. No record lookup or assertion
  that a record exists; jobs enforces authorization after its own sign-in.

All queries are dropped, including filters and assistant/editor state. The user
may need to find the record again after signing in. Saved Careers records remain
in Careers; unsaved in-memory state is not recovered or silently submitted.
Exception: `/dashboard/post-job/preview` restarts at `/dashboard/post-job`, not
the preview step, because the old-origin unsaved draft cannot be transferred.
The replacement worker remains unchanged: offline generic launch guidance only;
these additional pages require network access. No new storage/cookie deletion.

Owner-reported evidence: Careers jobs sign-in/reset and fresh iPhone installation,
sign-in and reopening passed. This does not establish old-www migration, Android,
push delivery, OAuth, private role or payment coverage.

Evidence correction, 2026-10-18: the owner reports that Google sign-in from a
fresh desktop jobs PWA selects an account but returns to the public homepage on
the OLD growvelt.com address. Careers' hostname-bound Google/OAuth gate is OPEN
and BLOCKS cutover. Earlier generic success answers are not OAuth evidence.
Separate email/password and password-reset confirmations remain recorded;
iPhone installation/reopen evidence does not override this OAuth failure.
Careers owns its OAuth redirect/callback investigation and fix. Learning must
not exchange Careers codes or forward tokens to work around it. Keep www with
Careers and all cutover flags disabled until corrected and retested on jobs.

Careers-reported repair, 2026-10-18 (not independently verified here): commit
`3fb75bb`, Vercel `9sw4g6rHojGv9xFS1Jk52MYuGD8u` Ready/Current Production.
Careers reports initiating-origin preservation for Google/LinkedIn, mobile role
context retention and callback session initialization without a second PKCE
exchange. It reports 24 focused tests, TypeScript, lint and production build
passing. Its hosted allowlist now has 12 entries: the prior eight plus exact
HTTPS jobs/www `/auth/callback?role=job_seeker` and `?role=recruiter` URLs;
no wildcard, Site URL remains `https://www.growvelt.com`. These are Careers-side
reports, not Learning settings changes. OAuth gate remains OPEN pending owner
Google retests on jobs desktop AND mobile that confirm the final hostname stays
jobs. Deployment success alone does not clear that gate. No cutover authorized.

Subsequent owner retest, 2026-10-18: Careers reports the owner explicitly answered
"I have tested it and it works. So it works as expected" to the requested
desktop/mobile Google sign-in retest after `3fb75bb`. Mark hostname-bound Google
OAuth owner retest PASS, superseding the open Google gate above. This is
owner-reported evidence, not independent Learning testing, and does not establish
LinkedIn, Android/old-www installed-PWA migration, push or payments. Remaining
contract/drain/rollback gates still block www transfer; cutover remains disabled.

Local follow-up verification, 2026-10-18: PASS compatibility/unit isolation,
Learning URL/Auth/payment-guard regression suite, targeted lint (zero errors),
clean-snapshot future optimized build/TypeScript and loopback Next HTTP rehearsal.
HTTP checks cover every finite private page, bounded detail pages and all four
application steps for GET/HEAD and rejected POSTs. PASS disposable Chrome browser
rehearsal: old-worker update/offline launch plus 360px application restart pages,
query/hash removal and selected private redirects with no inherited referrer.
Jobs destinations are mirrored on loopback; no hosted Auth/provider requests.
The snapshot excludes hosted .env.local and unrelated untracked UI/PWA work.
No additional commit, push, deployment, hosted configuration or domain transfer.

### Final local action-link and rollback rehearsal (2026-10-18)

PASS `test-careers-action-links.mjs`: case-preserved bounded referrals, exactly
one selector on reviewed unsubscribe pages, malformed/duplicate/mixed selector
rejection, no selector reflection, no body/header/cookie access, token-free draft
restarts, old payment no-replay/no-repay response, host/flag isolation and no new
Learning route collisions. PASS existing compatibility and URL/Auth/payment guard
suites. PASS updated clean future optimized build + TypeScript + real Next HTTP
GET/HEAD/POST rehearsal. Final targeted lint, including the corrected browser
fixture, passed with zero errors; Git diff whitespace check passed.

PASS disposable Chrome browser: all new redirects use validated jobs Location
headers mirrored onto a synthetic loopback receiver, with no inherited query,
hash or referrer beyond the ONE explicitly reviewed unsubscribe selector.
Synthetic referral receiver stores the synthetic code locally; it does not prove
hosted Careers attribution/signup. Invalid unsubscribe guidance removes the old
query/hash and does not perform any subscription write.

PASS replacement worker -> exact read-only Careers committed `public/sw.js`
at the SAME `/sw.js` URL, revision `3fb75bb848de20078d03c6fc7a208ca5f2bee8db`,
SHA-256 `693a97bad1a8eda84c43abcc2e91219e496c929d44c7a84ed6681f284ca1bc54`.
Real browser observed existing active worker + installed waiting worker, then
`SKIP_WAITING` -> activated/controller change, online and offline rollback launch,
and preserved unrelated caches/cookies/localStorage. Actual rollback source's
notification-click handler was tested separately with API doubles: normal
Careers same-origin destination and rejection of a foreign payload. No real push
delivery/native notification was performed. Launch/offline HTML/assets were local
fixtures; this is not an actual installed iOS/Android or live-domain rollback.

An initial test incorrectly treated an asynchronous waiting-state predicate as
sufficient evidence; it was replaced with explicit bounded in-page waiting.
The exact active/waiting assertions were retained and passed. Careers source was
not edited, and no Git configuration was persisted. Retest if chosen rollback
worker bytes change. Careers' original worker deletes its own `growvelt-pwa-*`
cache namespace on activation; unrelated `learning-offline-v1`/`unrelated-cache`
were retained. Learning's transition worker remains narrower (numeric known
Careers cache names only). Neither worker migrates Auth or database state.

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
   privacy/retention, monitoring and rollback worker. Careers reports the owner's
   target includes apex `growvelt.com` -> www Learning, preserving its current 307
   redirect; attachment moves separately AFTER www Learning passes validation.
   Apex is NOT automatically transferred with www. Unknown old route
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
   jobs/learn assignments. Do not change apex or DNS at this step. Confirm old-www worker/launch/Auth/POST
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
   After www passes both products' acceptance, separately move apex attachment to
   Learning with the SAME existing 307 -> `https://www.growvelt.com` behavior.
   Review the actual Vercel/DNS evidence before touching it; no arbitrary apex DNS
   edits. Record the original apex attachment/redirect and restore it on rollback
   if it was changed. Verify apex over HTTPS after the separate move.
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

## Host-aware safety bridge — local implementation, 2026-10-18

This section supersedes the earlier unresolved transient-attachment design risk;
account-specific deployment/alias execution still needs review. Separate server
flag `LEARNING_WWW_SAFETY_BRIDGE_ENABLED` is OFF by default and is NOT configured
in any hosted environment. Local implementation is uncommitted/unpushed.

Mode selection uses the platform request URL's exact www hostname. It does not
read/forward Host, Forwarded or X-Forwarded-Host values as routing authority.
An exact-host all-path proxy matcher covers unknown APIs, actions, bundles and
namespaced Learning endpoints as well as the finite historic paths. The bridge
runs before normal Learning proxy/session/backend processing.

- Bridge OFF: unchanged existing behavior.
- Bridge ON + future settings incomplete, OFF or invalid: finite Careers routing
  remains available; root 200 handover guidance; unknown pages 404 guidance;
  unsafe/unknown API requests 409 with no Auth/DB/provider work or replay.
  Unknown Learning Auth/payment endpoints cannot fall into their real handlers.
  No request body/cookie/authorization parsing, token reflection or broad redirects.
- Only seven exact public branding/favicon assets pass through; no app bundle or
  arbitrary static prefix. robots disallows indexing. During the bridge both old
  manifest URLs retain Careers-moved identity, not a premature Learning install.
- Bridge ON + ALL future settings valid/enabled: normal future Learning routes
  plus existing finite Careers compatibility. No shared accounts/cookies/data.
- learn and www.learn are unchanged in every bridge case; original Learning Auth
  and payment receivers remain on their origin during grace.

Before any transfer, a separately approved bridge-enabled LEGACY build must be
the VERIFIED CURRENT/default Learning project deployment. Learning URL and shared
hosted settings remain legacy/cutover OFF; enable the server bridge through
reviewed per-deployment configuration. In that approved bridge deployment only,
build/runtime Careers cross-links should use jobs so old learn's Careers link
does not land on Learning after www changes ownership. The Learning URL remains
learn; no shared Production variable is edited. Validate/pin learn/aliases and record that
safe immutable build. Then staging FUTURE with skip-domain cannot make temporary
project attachment depend on atomicity: default attachment gets the safe bridge.
Do not attach www while CURRENT can still be old e64ba73 or another unbridged
build. Freeze routine deployments for the window. No bridge deployment, future
staging, account linking, domain transfer, provider or Auth change was run here.

Local bridge tests: state matrix, fail-closed invalid config, actual transpiled
proxy with throw-on-backend/fall-through doubles, exact-host matcher via installed
Next testing utility, forged headers, arbitrary methods/unknown paths, token-free
mobile guidance, original learn behavior. The optimized legacy-config bridge
build/TypeScript and real Next HTTP passed for www bridge ON, learn and www.learn
bridge ON, and www bridge OFF. Backends/providers disabled, no hosted write tests.
Browser rehearsal passed bridge -> future fixture -> Careers rollback; source
revision dfb454aa1b558781422a6b0e3cdb007bfc4b80f8 has the same recorded worker SHA.
Actual installed mobile migration/push and provider/drain checks remain separate.

Final bridge follow-up checks PASS: separate FUTURE optimized build/TypeScript
with server bridge enabled (valid future bypass) plus real Next compatibility
HTTP; all 17 existing Phase 5 suites; original Auth/session propagation;
subscription checkout/webhook and management regressions; targeted lint and
whitespace checks. Bridge-enabled legacy-origin + jobs cross-link configuration
is also covered by the URL/bridge unit matrix. No shared URL-default module or
environment file was changed. Both bridge and cutover flags still default OFF.
Nothing was staged, committed, pushed or deployed; HEAD remains e64ba73.

Fixture corrections, not relaxed product assertions: bundled Node fetch ignored
an overridden Host header, so HTTP coverage uses native HTTP to the same loopback
listener with a real Host. No production DNS/trustHostHeader override is enabled.
Installed Next exposes the older `unstable_doesMiddlewareMatch` testing export;
tests use that actual matcher implementation with standalone AsyncLocalStorage
initialization. All assertions remain in force.

Latest Careers-reported provider evidence: all four live/test callback/webhook
fields are empty in its distinct Growvelt Technologies Limited Paystack business;
no URL rewrite required. Subsequent owner report, verified in the Careers chat:
no pending/ongoing Careers Paystack transactions and no old-www Careers app on the
owner's own devices. Record as OWNER-REPORTED ONLY, not independently inspected
provider state, all-user absence, native migration or push evidence. No inference
from success-only transaction filters. Compatibility remains necessary for other
users and late-returning devices; measured drain/operator acceptance still applies.

Careers reports default-off checkout-entry guard 7d22a21 published, original-origin
callback/verification POSTs retained. Sixteen-file Learning dormant release scope
reviewed by Careers; owner's direct continue/finish instruction verified. This
authorizes preparation release only, not flag activation/hosted settings/transfer.

Exact release list and staged/operator checks are in
`docs/learning-domain-compatibility-release-proposal.md` (sixteen-file revision).
