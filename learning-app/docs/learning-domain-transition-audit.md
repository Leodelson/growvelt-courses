# Learning domain transition: read-only audit and coordination plan

Audit date: 2026-10-16 (Africa/Lagos). Baseline commit: `35021b7`.
Status: **PLANNING ONLY — NOT APPROVED FOR CUTOVER OR DEPLOYMENT.**

Subsequent local implementation and the user-confirmed seven exact route collisions
are recorded in `learning-domain-transition-preparation.md`. This document retains
the original read-only baseline; its speculative collision families are not an
assertion that all those paths collide.

### Status addendum — 2026-10-17

Careers/user now confirms the exact target **`https://jobs.growvelt.com` (with w)**
has its Namecheap CNAME configured, Valid Configuration in Vercel and a working
HTTPS Careers homepage. Careers' two correct jobs Auth callback/reset entries
are additive to its original six; its Site URL is still `https://www.growvelt.com`.
No www transfer has happened. Learning made no live changes or new hosted checks
for this update. The earlier DNS probe limitation below is historical evidence,
not a current assertion that jobs DNS is unconfigured. Current local checks and
pending old-www route/PWA coordination are recorded in the preparation document.
Working jobs HTTPS is not cutover approval.

## Scope and safety

Target: Learning `https://www.growvelt.com`; Careers `https://jobs.growvelt.com`.
Learning remains Vercel project `growvelt-learning` and Supabase project
`qtcpjcaoptdunuefwvgc` (Growvelt Courses Project, Growvelt Courses organization).
Careers remains a separate project (`growvelt-jobs`), database, Auth system and PWA.

This audit changed no production settings, DNS, domains, provider configuration,
email templates, application code, databases, Docker services or Careers files.
No commit, push, deployment, payment, email send, sign-in test or synthetic database
write was performed. Existing unrelated working-tree changes are preserved.
Only this document and two read-only audit scripts were added locally.

## 1. Verified current hosted configuration

### Learning Vercel domains

Dashboard and unauthenticated HTTPS GET checks agree:

| Domain | Current behavior |
| --- | --- |
| `learn.growvelt.com` | Production; homepage HTTP 200 |
| `www.learn.growvelt.com` | HTTP 307 to `https://learn.growvelt.com/` |
| `courses.growvelt.com` | HTTP 308 to `https://learn.growvelt.com/` |
| `www.courses.growvelt.com` | HTTP 308 to `https://learn.growvelt.com/` |
| `growvelt-learning.vercel.app` | Production; homepage HTTP 200 |

All five show Valid Configuration. Neither target domain is assigned to Learning
in this dashboard. This does not establish their ownership elsewhere.
DNS CNAME probes returned `ECONNREFUSED` from this environment; actual Namecheap
records, TTLs, apex behavior and future `jobs` certificate readiness are unverified.
Do not infer a DNS fault from this probe failure: current Learning HTTPS works.

### Learning hosted Supabase Auth

Read directly from Authentication > URL Configuration in the confirmed Learning project:

Site URL: `https://learn.growvelt.com`

Redirect allowlist, all five existing entries:

1. `https://learn.growvelt.com/auth/callback`
2. `http://localhost:3000/auth/callback`
3. `http://localhost:3001/auth/callback`
4. `https://growvelt-learning-dbqy4genc-leodelsons-projects.vercel.app/auth/callback`
5. `https://growvelt-learning-dbqy4genc-leodelsons-projects.vercel.app/auth/callback?next=%2Fdashboard`

Email and Google providers are enabled; email confirmation is enabled. Other
listed providers are disabled; no custom providers were listed.
Google's Supabase provider callback is:
`https://qtcpjcaoptdunuefwvgc.supabase.co/auth/v1/callback`.
That provider callback must remain bound to **Learning's** Supabase project.
It is not the same as the application's `/auth/callback` destination.
No client secret was revealed or changed. Google Cloud Console authorized origins,
redirect registration and consent-screen URLs were not independently inspected.

`supabase/config.toml` is local configuration, not hosted configuration: Site URL
`http://127.0.0.1:3000`, additional redirect `https://127.0.0.1:3000`.
It must not be pushed as a production replacement for the settings above.

### Local environment is not a local data sandbox

Only non-secret URL/mode values were inspected from `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL=https://qtcpjcaoptdunuefwvgc.supabase.co`
- `PAYSTACK_MODE=test`
- `PAYSTACK_CALLBACK_URL=http://localhost:3000/payments/paystack/callback`
- `NEXT_PUBLIC_APP_URL` absent.

These are **not evidence of Vercel Production environment values**. No secrets
were printed. Vercel's deployed callback/mode values and Paystack dashboard Test
and Live callback/webhook settings still require a coordinated, read-only operator
snapshot. Do not assume current Test Mode from local values alone.
Before any future write testing, explicitly select and verify local Learning
Supabase URL **and matching local keys**, or use an expressly approved dedicated
test workflow. No new Supabase project is needed or proposed by this plan.

## 2. Route inventory and collision map

Run `node scripts/audit-learning-domain-transition.mjs` for every individual
Learning page/handler source and hard-coded host location; `--json` is available
for an exact comparison against the Careers route inventory.
The current tree has 125 tracked page/handler routes plus one untracked
`/ui-review/phase5` route (exclude that from production).
Metadata/static endpoints additionally include `/favicon.ico`, `/robots.txt`,
`/sitemap.xml` and `/site.webmanifest`; assets occupy `/logo/*`, `/images/*`,
`/videos/*`, icons, social images and `/_next/*`.

**An exhaustive intersection with Careers cannot be asserted until Careers supplies
its actual route list, redirects, API methods, old email/payment URLs and SW scope.**
The table below covers all Learning route families and foreseeable collisions,
not invented claims about which routes Careers currently implements.

| Existing path/family on Learning | Risk when `www` previously served Careers | Required policy before cutover |
| --- | --- | --- |
| `/` | Same old URL now means a different product | Intentional new Learning homepage; prominent Careers link. Cannot preserve both meanings of an identical URL. |
| `/dashboard` and **all** descendants | Bookmarks and installed Careers apps may arrive here | Shared-path ownership decision; never silently send an old Careers user into a Learning account screen. |
| `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/check-email` | Old Careers links, recovery flows and navigation can look identical | Separate product-specific auth entrypoints; preserve old Careers flows by an explicit compatibility policy. |
| `/auth/callback`, `/auth/error` | Wrong project may receive authorization codes; PKCE verifier is origin-bound | Keep product-specific callbacks. Drain original-origin flows; never try codes against both Supabase projects. |
| `/settings`, `/dashboard/profile`, `/dashboard/settings` | Old Careers account/settings links could open Learning | Explicit old-path routing or separate Learning namespace. No account merging. |
| `/admin/*`, `/instructor/*`, `/dashboard/admin/*`, `/dashboard/instructor/*` | Generic role/workspace routes; role names are not proof of product | Explicit ownership per route; retain Learning role/RLS boundaries. |
| `/api/auth/*`, `/api/admin/*`, `/api/instructor/*`, `/api/company/*` | Generic endpoint and method collisions; cross-host POST loses session/origin assumptions | Product-scoped Learning API namespace if overlap exists; no blanket browser/API redirect or shared credentials. |
| `/api/payments/paystack/*`, `/api/company/payments/paystack/reconcile`, `/payments/paystack/callback` | Wrong payment processor endpoint could receive another product's event/reference | Stable Learning-owned webhook receiver and product-specific callback; preserve exact references and signed body. |
| `/api/internal/commercial/release-matured` | Scheduled authenticated GET has side effects despite GET method | Preserve Learning's cron path/project/CRON_SECRET; never test it by invoking the job or forward to Careers. |
| `/api/inquiries`, `/api/newsletter/subscribe`, `/api/course-video-covers/[courseId]` | Public form/media API overlap still matters | Product-specific routing; don't redirect submitted forms between products. |
| `/learn`, `/courses/[slug]`, `/providers/[slug]` | Old Careers may already use Learning cross-links or provider/course paths | Compare exact Careers rules; redirect old Learning aliases to canonical public course URLs. |
| `/teach`, `/teach/apply`, `/teach/application` | Careers may link to/host teaching onboarding | Agree destination; keep Learning signup intent and approval logic. |
| `/certificates`, `/verify-certificate/[code]`, `/dashboard/certificates/*` | Issued certificates/QR codes must remain valid | Preserve old Learning verification URLs indefinitely; route explicit verification paths to Learning. |
| `/company-learning`, `/dashboard/company/*`, `/dashboard/subscriptions`, `/dashboard/test-subscriptions/[planId]` | Company/subscription naming may overlap | Compare exact paths; retain private-test allowlist and test/live gates. |
| `/about`, `/contact`, `/blog`, `/partner-with-growvelt`, `/frequently-asked-questions`, four policy pages | Both products can have these public URLs | `www` becomes Learning; agree where old Careers SEO/content links point. Preserve policy versions, don't imply account migration. |
| `/robots.txt`, `/sitemap.xml`, favicon, manifest, `/sw.js`, `/offline.html`, `/pwa/*`, `/_next/*`, shared asset names | Old Careers origin can retain a controlling SW/caches; old assets may be requested after swap | Careers SW/manifest retirement or bridge plan and isolated Learning PWA identity; never broadly rewrite `/_next/*` across builds. |
| Unknown old Careers-only paths (e.g. job detail, applications, employer tools, unsubscribe, referrals) | Learning may return 404 or collide with a future feature | Careers must supply patterns, methods and query/fragment semantics; route only proven legacy paths to `jobs`. |

### Recommended decision, not implemented

The lowest ambiguity solution is to reserve a product namespace for Learning's
**overlapping** authenticated routes/API/auth flow on `www` (for example
`/learning/dashboard/*`, `/learning/auth/*`, `/learning/sign-in`,
`/api/learning/*`) while keeping the public homepage at `/`. Old `www` Careers
paths can then retain explicit legacy handling. This is a proposal requiring user
and Careers agreement, **not a committed URL scheme**.

If retaining Learning's unprefixed `/dashboard`, `/auth/*`, `/api/*` is preferred,
accept that identical old Careers URLs cannot also transparently redirect by path
alone. Agree on product chooser pages for ambiguous UI routes and narrowly scoped
callback/API compatibility. Cookies, referrers and a `?product=` marker are not
reliable classifiers for historical unmarked links. Never implement a generic
`www/:path* -> jobs/:path*` rule: it would redirect Learning itself.

## 3. Authentication, users and access preservation

- Keep Learning's existing Supabase URL, publishable/service keys, users, IDs,
  tables, RLS, Storage buckets and entitlement records. Do not copy/import users
  into Careers. Learning email/password and Google identities remain the same.
- `app/lib/supabase/browser.ts`, `server.ts`, `auth-callback.ts` and `proxy.ts`
  use `@supabase/ssr` cookies without a custom Domain or shared storage key.
  Installed dependency defaults are path `/`, SameSite Lax, no Domain override;
  default project-derived name is `sb-qtcpjcaoptdunuefwvgc-auth-token` (chunked
  names/PKCE verifier cookies also occur). No sibling-domain cookie sharing is
  configured in Learning. These are source/default observations, not an authenticated
  capture of every production Set-Cookie header.
- Host-only `learn` cookies do not become `www` cookies. Existing users normally
  sign in once on `www` with the same Learning account and regain the same courses,
  progress and purchases. Do not transfer tokens via query strings, log tokens,
  set Domain `.growvelt.com`, or reuse Careers cookies to avoid that sign-in.
- `auth-form.tsx` and `password-forms.tsx` build callbacks from the browser origin;
  `/auth/callback` exchanges a PKCE code on its request origin, attaches cookies to
  that redirect response, and uses private/no-store headers. `getSafeNextPath`
  accepts only certain relative Learning destinations, preventing open redirects.
  A new namespace must update this allowlist, proxy matchers, all links and tests.
- Finish in-flight OAuth/signup/recovery flows on the **original origin** where
  their verifier was created. Do not redirect `/auth/callback?code=...` from
  `learn` to `www` before exchange; the verifier is absent on `www`.
  Keep old-origin callback/error/recovery routes during the grace period. After a
  successful original-origin flow, link to the new site and request a fresh sign-in.
- Old Careers callbacks on `www` need the equivalent Careers-owned compatibility
  plan **before** handing `www` over. A redirect to `jobs` alone does not move its
  PKCE verifier. No callback should exchange with the wrong Supabase project.
- APIs enforce same-origin request checks in `app/lib/security/request-origin.ts`;
  cross-host redirection of POSTs is not a session migration solution. Keep the
  checks and require authenticated retry on the chosen product origin.
- Theme, language, consent, saved UI preferences and local drafts are origin-local;
  don't promise their automatic transfer. Announce the new login/install behavior.

## 4. Hard-coded URLs and required Learning settings

All items below are future prerequisites, not changes made in this audit.

| Component/setting | Current evidence | Required coordinated change |
| --- | --- | --- |
| Vercel domain ownership | Five domains in section 1 | Attach `www` to Learning only after Careers is ready on `jobs`; define apex `growvelt.com` ownership/redirect explicitly. Keep all old Learning hostnames and TLS. Snapshot assignments first. |
| Supabase Site URL | `https://learn.growvelt.com` | Set `https://www.growvelt.com` only in approved window; preserve Learning project. |
| Supabase redirect allowlist | Five URLs in section 1 | Add chosen `www` Learning callback plus required query variants for dashboard, teaching intent and password reset. Keep old `learn` callback and existing development/approved preview entries until expiry/grace review. No root-domain wildcard and no Careers callback in Learning. |
| OAuth provider registration | Google enabled; provider callback under Learning Supabase | Keep Supabase provider callback unchanged; check Google authorized JS origins (add `www` if used), consent links and authorized domains. Do not replace provider callback with app callback or Careers Supabase. |
| CAPTCHA/Turnstile | Token verification checks exact request hostname in `/api/auth/verify-turnstile` | Verify widget hostname permissions cover chosen `www` origin while retaining old `learn` as required; don't disable hostname/action checks. Cloudflare settings not inspected here. |
| SEO origin | `app/lib/seo.ts:1` hard-coded `learn` | Approved canonical origin `www`; root metadataBase, OpenGraph, JSON-LD, course canonical URLs, sitemap and robots derive from it. Revalidate sitemap. Keep dashboard/private pages noindex. |
| Public/dash Careers links | `public-header.tsx`, `Footer.tsx`, `learning-shell-navigation.tsx`, `public/home-discovery-sections.tsx`, About/blog content, welcome email, certificate footer | Replace only Careers destinations with `https://jobs.growvelt.com` and equivalent paths once live; `/career-assistant` stays a Careers path. Do not globally replace all `growvelt.com` strings. |
| Legal copy | `app/terms-of-service/page.tsx` names `www.growvelt.com` as jobs platform | Update accurate product-host description at cutover; email addresses remain unchanged. |
| Certificate links/QR | `certificate-renderer.tsx:22` pins `learn` | Use approved Learning canonical origin for newly rendered certificates; keep old verification GET redirects and existing codes working indefinitely. No certificate reissue required. |
| App email HTML | `growvelt-email-template.ts` pins logo/footer to `learn` despite a baseUrl input; payment email fallback also pins `learn` | Centralize trusted Learning origin; update logo/footer and generated action links together. Invitation/welcome actions currently use request origin. Audit queued/stored URLs; no mass resend. |
| Supabase Auth email HTML | 13 local templates pin `learn` for assets/footer; action variables `.ConfirmationURL`, `.Token`, `.NewEmail` are used as applicable | Update saved hosted templates only after project verification and approval, preserving all auth variables and subjects. Local files alone do not change hosted templates. Saved HTML was not re-exported in this audit (dashboard navigation timed out); compare every hosted template before cutover. |
| Vercel URL env | `NEXT_PUBLIC_APP_URL` used as payment-email base, otherwise request-origin generation; exact Production env not exported | Inventory Production/Preview separately; set only Learning app origin/callback settings, not keys or payment mode. A build is required for changed NEXT_PUBLIC values. Environment-name suggestion does not override hard-coded URLs. |
| Paystack callback env | `PAYSTACK_CALLBACK_URL` shared by course, company and subscription initialization | New canonical Learning callback/path after route agreement; preserve GL-/CP-/GS- references, old in-flight callbacks and existing orders. |
| Live payment code guard | `paystack-config.ts` requires hostname **learn.growvelt.com** and path `/payments/paystack/callback` in Live mode | Update exact trusted origins/path allowlist and unit tests before changing env; do not broaden to any HTTPS domain. This is a real future blocker even if current testing is Test Mode. |
| Paystack webhook settings | Code receives POST `/api/payments/paystack/webhook`, verifies raw body `x-paystack-signature`, idempotently reconciles events | Read snapshot actual Test and Live dashboard URLs; retain a working non-redirecting old Learning receiver through grace. Configure new Learning receiver without changing keys/modes/gates; verify duplicate/retried/late events exactly once. No webhook redirect assumption. |
| Cron | `vercel.json`: `/api/internal/commercial/release-matured` at `0 4 * * *`, bearer CRON_SECRET | Keep in Learning project; update path only if namespacing requires it. Do not execute as an audit probe. |
| Inquiry attribution | SQL snapshot default `source_page='learn.growvelt.com'`; newsletter source tag `growvelt-learning-footer` | Treat historical source_page strings as history, not redirect configuration. Don't rewrite rows or old migrations. Consider new attribution default only if actual future writes use it. |
| Resend/domain mail | Application sends from no-reply@growvelt.com; support/refund mailboxes | Host move does not require changing MX, SPF, DKIM, DMARC or mailbox addresses. Leave Namecheap/Resend DNS untouched unless separately reviewed. |

Live GET evidence: homepage canonical is `https://learn.growvelt.com`; robots Host
and Sitemap point to `learn`; sitemap entries inspected use only `learn`. Signed-out
`/dashboard` redirects 307 to `/sign-in?next=%2Fdashboard`. Code-less `/auth/callback`
redirects 307 to the Learning auth error with private/no-store headers.

## 5. Existing PWAs and the old Careers origin

Learning's deployed manifest is named Growvelt Learning, with 192/512 PNG icons,
standalone display, and **no explicit `id`, `start_url` or `scope`**.
Live `/sw.js` and `/offline.html` return 404. Root layout does not mount the local
PWA provider. The local `public/sw.js`, offline/PWA assets and components are
untracked; they contain Careers-specific routes/categories and a `growvelt-pwa-v5`
cache namespace. Do not ship or repurpose them in this domain change.

This proves current deployment state, **not** that no user ever installed an old
Learning shortcut/PWA or has an earlier worker. Obtain real device evidence.

- A PWA/shortcut installed at `learn` does not automatically become a `www` app.
  Keep its old launch URL online; offer the new site/install path and explain the
  one-time login/reinstall. Cross-origin navigation may leave standalone scope;
  verify iOS/Android rather than promise seamless in-place migration.
- Careers owns its current `www` service-worker migration. A root-scope worker
  can outlive a Vercel domain swap and can intercept the new Learning site.
  A 404 at the old worker URL is **not** a dependable retirement strategy.
- Before cutover, Careers must report installed manifest identity/start_url/scope,
  worker script URLs, caches, push destinations/subscriptions and its proposed
  safe update/grace bridge. Preserve a small, agreed compatibility worker at old
  script URLs if required. Do not replace it with Learning behavior blindly or
  delete origin-wide storage/caches. Returning users and offline installs need
  testing, including those who miss the pre-cutover update.
- New Learning PWA needs an explicit product-specific identity and intentional
  scope if full PWA behavior is introduced later. A different manifest ID does
  **not** protect Learning from a pre-existing root-scope Careers worker.
- Existing Careers push endpoints/installations won't automatically migrate to
  `jobs`. Careers handles re-registration and consent, not Learning. Do not send
  Careers notifications into Learning's `/dashboard` after cutover.

## 6. Safe redirect and staged cutover plan (approval required later)

1. **Coordinate first.** Careers returns actual route/SW/auth/payment inventories,
   target `jobs` readiness and rollback owner. Agree shared-path policy, apex
   behavior, compatibility endpoint owners, grace periods and a cutover window.
2. **Prepare locally.** Review route/namespace changes and one trusted URL module,
   paystack guard, links/email/SEO changes and migration-specific tests. Keep old
   production defaults until deliberately configured. Build with no hosted writes.
   No runtime changes were made in this audit because the path decision is pending.
3. **Rehearse without moving production.** Approved preview/local host simulation,
   separate browser profiles, explicit local Learning Supabase URL/keys for writes.
   Use mocks for callbacks/webhooks and fresh disposable PKCE sessions. Do not
   recreate either product's Supabase stack or modify Docker for this plan.
4. **Preflight settings after explicit approval.** Snapshot current domains/DNS,
   deployed commit/env URLs, all hosted auth templates, OAuth/Turnstile and Paystack
   endpoints. Validate `jobs` in Careers chat first. Add narrowly scoped future
   Learning callbacks without removing current ones, only when separately approved.
5. **Cutover only in agreed window.** Careers owner performs its project work.
   Transfer `www` assignment to Learning; keep old Learning hostnames on Learning.
   Apply coordinated settings/build and make new canonical URL live. No database
   migration, key rotation, payment activation or account merging is required.
6. **Grace phase: no blanket domain redirect on `learn`.** Keep original-origin
   auth callbacks/recovery, legacy app API requests, signed webhook receiver and
   required PWA endpoints working. New ordinary GET/HEAD page requests can use
   temporary 307 redirects to `www` using an explicit path map, preserving encoded
   path and query exactly. If namespaces are selected, map them rather than merely
   swapping the hostname. Fragments aren't sent to the server; test browser fragment
   inheritance and any client bridge explicitly. Never carry session tokens in URLs.
7. **Old machine endpoints:** respond directly or use a reviewed internal handler
   compatibility layer; do not rely on Paystack following redirects or browsers
   preserving session cookies/CSRF across redirected POSTs. Keep the old authenticated
   request origin available until clients reload or show a safe retry instruction.
   Old payment-return GETs can redirect only when new-session behavior and exact
   reference preservation have been tested; otherwise render the legacy confirmation.
8. **After success and drain:** change stable public GET redirects to permanent
   308, update old aliases directly to new canonical (avoid redirect chains), submit
   new sitemap/Search Console move as eligible, retain old public link/certificate
   redirects long-term. Retire sensitive compatibility only after measured expiry,
   queued email/payment completion and Careers PWA sign-off. No arbitrary same-day
   deletion of old callback allowlist entries or webhook receivers.

## 7. Test matrix and evidence

### Performed now (non-mutating)

- Source route/host/PWA inventory executed successfully.
- Public HTTPS probes: all five domain root behaviors verified; canonical,
  manifest, robots, sitemap, signed-out dashboard and code-less callback verified.
- OAuth callback/session propagation and safe redirect regression test: PASS.
- Strict Paystack mode/config guard regression test: PASS (dummy keys only).
- Isolated subscription checkout/webhook core contract tests: PASS.
- Subscription management ownership/provider/link regression test: PASS.
- ESLint on the two audit scripts: PASS.
- Direct CNAME DNS probes: unavailable (`ECONNREFUSED`), not a deployment failure.
- No hosted write/end-to-end paid or Auth account tests were run. These passing
  baseline tests do not constitute a rehearsal or prove cutover readiness.

### Required before release

| Test | Acceptance criterion |
| --- | --- |
| Domain/SSL and rollback | All old aliases plus target resolve with valid TLS; chosen apex behavior; domain reassignment rollback rehearsed. |
| Collision comparison | Every Careers route/method and generated URL classified; ambiguous exact paths have a signed-off policy; no broad catch-all or wrong-product auth/API. |
| Public SEO | One-hop old Learning public URL redirects; new canonical/OG/JSON-LD/sitemap host consistent; no loops; private pages remain noindex. |
| User access | Existing learner/instructor/admin/company account on new origin sees same IDs, courses, progress, entitlements and subscriptions after login. No cross-project session use. |
| Authentication | Password and Google login, signup confirmation, teaching intent, recovery, signout, protected pages, rejected external `next`; new and original-origin in-flight PKCE flows. Preserve cookie attributes and no-store. |
| Old Careers URLs | Bookmarks, job links, auth/recovery emails, legacy APIs, links with next/referral/unsubscribe params reach Careers or defined compatibility state, never Learning by mistake. |
| Learning URLs | All generated inventory routes considered; encoded slugs/query strings, certificate QR, invitations, policy/footer links, course/video assets. |
| Payments | Course/company/subscription Test Mode checkout, exact same reference return, verify/reconcile, manage link, duplicate/late/out-of-order signed webhook, rejection of invalid signatures; no duplicate charge/access. Live gates unchanged. |
| API/cron isolation | Cross-origin write rejected; unauthenticated access denied; no forwarding to Careers; scheduled job remains Learning-only without duplicate invocation. |
| Emails/CAPTCHA | All 13 hosted Auth templates exported/compared to source; variables preserved; existing and new links function; widget authorized hosts and hostname/action verification still work. |
| PWA and browser matrix | Fresh browser, existing www Careers worker/cache, missed-update/offline install, old Learning install/shortcut, iOS/Android standalone; no stale Careers UI/notification launch on Learning. New install identity/scope verified. |

### Local commands

```powershell
cd "C:\Users\HP\Projects\Leo website\learning-app"
node scripts/audit-learning-domain-transition.mjs
node scripts/audit-learning-domain-transition.mjs --json
# Optional network read-only baseline; no Careers app requests:
node scripts/probe-learning-domain-transition.mjs
node --experimental-strip-types scripts/test-auth-session-propagation.mjs
node --experimental-strip-types scripts/test-phase1b3a-live-config.mjs
node --experimental-strip-types scripts/test-phase4-subscription-checkout-core.mjs
node --experimental-strip-types scripts/test-phase4-subscription-management.mjs
```

## 8. Rollback

Before cutover record the exact Learning deployment, domain assignments/redirects,
non-secret URL settings, secret references (not exposed values), hosted email HTML,
provider endpoints and DNS records. Assign one owner per product and a stop signal.

Rollback triggers: wrong-product callback/API delivery, widespread login failures,
payment event delivery/reconciliation failure, stale Careers SW taking over Learning,
redirect loops, missing TLS or entitlement mismatch. Fail closed on uncertain money
state; do not ask users to pay again.

Reassign domains to recorded projects under coordinated operator control; restore
Learning's previous deployment and URL/env/SEO/template settings, Site URL `learn`,
and original webhook receiver. Keep additive callback URLs/compatibility temporarily
as needed for already-started flows. Do not invalidate all user sessions or restore
a database snapshot to undo a host move. Purchases/events during the window stay
in Learning's original database and must be reconciled idempotently.
Temporary redirects and no-store compatibility responses make initial rollback safer;
permanent redirects, cached SW updates, DNS caches and changed PWA installations can
outlive a rollback, so delay irreversible routing/cache decisions. Never delete
Careers storage, unregister its worker or move its users from this Learning chat.

## 9. Precise handoff message to Careers

> Planning only—do not cut over yet. Target is Careers `https://jobs.growvelt.com`
> on `growvelt-jobs`, Learning `https://www.growvelt.com` on `growvelt-learning`.
> Learning's read-only audit is complete on its side; no production changes or
> deployments were made. Learning stays on Supabase `qtcpjcaoptdunuefwvgc`; do not
> connect, copy users, share cookies or reuse keys between products.
>
> Please perform your own read-only Careers audit and return: (1) every current
> www/apex route and redirect pattern WITH methods, including `/`, `/dashboard/*`,
> sign-in/signup/reset, `/auth/*`, `/api/*`, payments/webhooks, job/employer links,
> referrals/unsubscribe and shared assets; (2) current Careers Auth Site URL,
> callback allowlist, cookie Domain/name/path and PKCE original-origin handling;
> (3) manifest id/start_url/scope, all SW script URLs/scopes, cache names and
> installed/push migration plan, including users who miss the advance update;
> (4) Vercel/domain/DNS readiness for jobs, old in-flight email/payment endpoints,
> and exact rollback steps. Don't edit Learning or either database.
>
> Identical old www URLs cannot represent both products automatically. Please
> assess reserving `/learning/*` and `/api/learning/*` for Learning's overlapping
> routes while keeping explicit old Careers compatibility routes. This is only a
> proposal; confirm an alternative if preferred. Never blanket-redirect www/* to
> jobs, blindly forward auth codes to a different origin/project, or redirect API
> POSTs/webhooks without a tested compatibility design. Your existing www root
> worker can control Learning after a domain swap, so propose a safe bridge/
> retirement plan before transfer. Also agree who owns apex growvelt.com.
>
> Learning currently has learn (Production), www.learn (307 to learn), courses and
> www.courses (308 to learn), and growvelt-learning.vercel.app (Production).
> We'll retain the old Learning origins, handle in-flight auth/webhooks there, and
> use temporary public redirects before permanent ones. Return your inventory,
> route-collision decisions, grace period, ready/not-ready status and proposed
> coordinated window. Neither chat should cut over until the user approves both
> plans together.

## References

- Supabase redirect allowlist and Site URL: https://supabase.com/docs/guides/auth/redirect-urls
- Supabase PKCE flow: https://supabase.com/docs/guides/auth/sessions/pkce-flow
- Vercel domain moves between projects: https://vercel.com/docs/domains/working-with-domains/transfer-your-domain
- Service-worker origin/scope model: https://web.dev/learn/pwa/service-workers

## Remaining gates

Careers inventory/collision decision and existing www SW handling; actual DNS/apex
policy; Google Console/Turnstile host checks; Vercel Production URL/mode snapshot;
actual Paystack Test/Live endpoint snapshot; saved hosted email export/comparison;
rehearsal evidence; explicit coordinated cutover approval. **Not ready to cut over.**
