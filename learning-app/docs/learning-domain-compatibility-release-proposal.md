# Narrow compatibility release proposal — 2026-10-18

Release review snapshot, 2026-10-18. This document is NOT authority to activate a
flag, stage FUTURE, move a domain or change hosted Auth/payment settings. Careers
reviewed the sixteen-file scope; the owner's direct instruction to continue/finish
the migration was verified in that chat. Only the dormant preparation release is
being published. Live baseline before release is e64ba73, both flags unenabled.
Final published SHA/deployment/rollback evidence belongs in the release handoff,
not an assumed self-referential commit ID in this precommit snapshot.

## Proposed commit

Suggested message: `Add dormant legacy-link compatibility and www safety bridge`.
Base: `e64ba7377e8c7bf79d3d849a6e84faedd9c1f444`. No new SHA exists yet.
Bridge revision supersedes the earlier nine-file proposal. Select ONLY these
sixteen paths, relative to Learning:

1. `app/lib/careers-compatibility.mjs`
2. `app/lib/careers-compatibility.d.mts`
3. `proxy.ts`
4. `scripts/test-careers-compatibility.mjs`
5. `scripts/test-careers-action-links.mjs` (new)
6. `scripts/test-careers-pwa-browser.mjs`
7. `scripts/test-learning-domain-transition-http.mjs`
8. `docs/learning-careers-compatibility-runbook.md`
9. This release proposal (new).
10. `scripts/test-learning-www-bridge.mjs` (new).
11. `scripts/test-learning-www-bridge-http.mjs` (new).
12. `scripts/test-learning-domain-transition.mjs` (test loader only).
13. `scripts/serve-learning-domain-rehearsal.mjs` (loopback test server only).
14. `next.config.ts` (isolated bridge test-build directory only).
15. `tsconfig.json` (bridge test-build types only).
16. `.gitignore` (bridge test-build output only).

Exclude the unrelated image deletion, enterprise-roadmap document edit,
`tsconfig.tsbuildinfo`, untracked UI review/PWA files and white-lady image.
No environment file, URL-default module, SQL migration, Auth template, provider
implementation, payment mode/key, dependency or Careers file is in this commit.

Product delta: dormant exact-route compatibility, narrow reviewed unsubscribe
selector redirects, no-replay payment warning, draft/application restarts. The
existing cutover gate still requires future-www configuration AND exact `true`.
The new separate SERVER-ONLY `LEARNING_WWW_SAFETY_BRIDGE_ENABLED` flag defaults
OFF. Its only active host is exact `www.growvelt.com`; it does not alter public
URL selection or activate the future Learning site. New paths have
no additional Learning page/API collision; regression tests reserve their names.

Evidence: action-link/compatibility/bridge state units and actual-proxy side-effect
doubles, installed Next matcher checks, Learning URL/Auth/payment guards,
clean BRIDGE and FUTURE optimized builds/TypeScript + real Next loopback HTTP,
all 17 Phase 5 suites, original Auth/session and subscription regressions,
targeted lint, mobile-width disposable Chrome bridge/redirect/worker tests
and exact Careers rollback-worker tests passed. Full details/limitations are in
the compatibility runbook. These tests
do not establish hosted integration, actual mobile old-install migration or live
provider reconciliation.

No source is staged and no new commit exists at this checkpoint. HEAD remains
e64ba73. Node's existing direct-TypeScript module-type warnings are unchanged;
no package/dependency edit was made to suppress them.

After approval, review the explicit staged diff, commit ONLY these paths, verify
the ancestry and push to main. First release retains all current production URL
defaults and cutover OFF. Verify exact Git/Vercel SHA and live learn/aliases,
canonical/sitemap, protected/Auth routes and original payment endpoint routing.
Do not perform a synthetic hosted DB/Auth/Storage/payment write merely to check it.

## Bridge state and containment policy

With the bridge OFF, current behavior is unchanged. With it ON, an exact www
request is intercepted BEFORE Learning's normal proxy/Auth/backend processing
unless ALL future settings are valid/enabled. The host comes from the platform
request URL, not caller-supplied Forwarded/X-Forwarded-Host headers. The proxy
adds an exact-host catch-all matcher, so unknown paths/actions cannot evade the
bridge by falling outside the old finite matcher list.

- Reviewed Careers routes reuse the same finite routing policy without forging
  future public URL variables. Old Auth codes are never exchanged or forwarded.
- Root: self-contained no-store/noindex 200 handover page linking jobs and learn.
  Other unknown GET/HEAD pages: 404 guidance, not the Learning application.
- Unknown APIs/unsafe methods: 409 success:false/retryable:false, no body read,
  database/provider/session action, replay or query/token reflection. This also
  blocks new namespaced Learning Auth/API/payment paths during the bridge.
- Only seven exact public branding/favicon assets can pass through. No broad
  asset, app-bundle or API prefix. robots disallows indexing; both manifest URLs
  retain the old Careers-moved identity during the bridge.
- Fully valid/enabled future settings bypass the temporary bridge; the existing
  legacy Careers contract still applies and Learning uses its namespaced paths.
  Incomplete/invalid future settings fail closed while bridge is ON.
- learn/www.learn are never intercepted by the bridge. Their existing original
  callbacks, payment routing, cookies and PWA behavior are retained.

The flag is NOT enabled in any hosted environment. The expanded release is still
local/uncommitted; its tests are not permission to publish or transfer anything.

## Vercel isolation: documented mechanism, not yet account-tested

Primary references, checked 2026-10-18:

- [Deploy options](https://vercel.com/docs/cli/deploy): production staging with
  `--skip-domain`, deployment-specific build/runtime overrides.
- [Alias operation](https://vercel.com/docs/cli/alias): explicitly assign one
  hostname to one deployment. Vercel prefers project-wide promotion for ordinary
  releases; this plan deliberately needs a reviewed single-host assignment.
- [Promotion](https://vercel.com/docs/cli/promote): changes the current deployment;
  it is not the proposed host-isolation step.
- [Domain inspection/attachment](https://vercel.com/docs/cli/domains): project
  membership and DNS/TLS verification are separate from selecting a deployment.
- [Cron behavior](https://vercel.com/docs/cron-jobs): production scheduling must
  be checked separately; skipping domain assignment is not a general side-effect
  sandbox.

The Learning checkout currently has no `.vercel/project.json` in either repo or
app root, and `vercel` is not on this session's PATH. CLI authentication, account
IDs, actual linked project/root directory, permissions and live alias mapping
have NOT been verified. No CLI was installed, project linked or secret pulled.
Root repository `vercel.json` contains historic courses-host rules; Learning's
own `vercel.json` contains a commercial-release cron. Confirm the hosted Root
Directory/build settings rather than assuming the two files are interchangeable.

### Two immutable deployments, not one global URL-setting edit

Record the VERIFIED full immutable URL and deployment ID for:

- LEGACY: narrow release on learn with BOTH flags OFF (new ID after its approved
  release; current fallback `e64ba73` / `FeiJv9prp6rUu5b1nrq6sR52Eb33`).
- FUTURE: same reviewed source, separate future build, only activated on www
  during the later approved window.

Do not invent deployment hostnames from IDs. Record learn/www.learn/courses and
the project default alias, redirect status and actual targets before staging.
Keep hosted Production variables unchanged for the initial release.

Future-only command SHAPE below is NOT TO BE RUN until separately approved and
the existing Learning project/team/root linkage is positively verified. Source
must be a clean export of the approved commit, not this dirty working directory.
The scope and URL values shown are non-secret; normal hosted secrets must never
be printed or copied into this document/command line.

```powershell
vercel deploy --prod --skip-domain --scope leodelsons-projects `
  --build-env NEXT_PUBLIC_LEARNING_SITE_URL=https://www.growvelt.com `
  --env NEXT_PUBLIC_LEARNING_SITE_URL=https://www.growvelt.com `
  --build-env NEXT_PUBLIC_CAREERS_SITE_URL=https://jobs.growvelt.com `
  --env NEXT_PUBLIC_CAREERS_SITE_URL=https://jobs.growvelt.com `
  --build-env NEXT_PUBLIC_LEARNING_DOMAIN_CUTOVER_ENABLED=true `
  --env NEXT_PUBLIC_LEARNING_DOMAIN_CUTOVER_ENABLED=true `
  --build-env LEARNING_WWW_SAFETY_BRIDGE_ENABLED=true `
  --env LEARNING_WWW_SAFETY_BRIDGE_ENABLED=true
```

Do not use `--yes` to accidentally create a new project, change shared Production
URL settings, expose source with `--public`, use an old prebuilt artifact or
run `promote`/global `rollback` as a substitute. Inspect Ready build provenance,
explicit overrides, all alias targets and the existing cron configuration. If
staging moves an alias or affects a scheduled operation, STOP before proceeding.
This documentation check does not certify that account-specific behavior.

Only in the approved transfer window, after Careers' drain/provider acceptance,
the intended hostname assignment is precisely:

```text
vercel alias set <VERIFIED_FUTURE_IMMUTABLE_URL> www.growvelt.com --scope leodelsons-projects
```

No command for learn, www.learn, courses, jobs or the default project alias belongs
in that operation. Domain membership must first be coordinated from Careers to
Learning by the owners; aliasing is NOT itself proof of a cross-project transfer.
Do not run a force-transfer command merely to suppress an ownership warning.

**Bridge resolves the transient-attachment design risk, not the operator checks.**
After separate approval, deploy the reviewed source as a bridge-enabled LEGACY
build: Learning URL remains learn, cutover false, and server
`LEARNING_WWW_SAFETY_BRIDGE_ENABLED=true` is supplied per deployment. For this
separately approved bridge deployment, also override its public Careers cross-link
origin to `https://jobs.growvelt.com` at build/runtime so legacy learn navigation
does not point back to the new Learning www homepage after transfer. This does
not activate future Learning routing. Do not change shared hosted Production
variables; these are reviewed per-deployment overrides only.
Make that bridge build the VERIFIED CURRENT Learning production deployment before
any www attachment, validate learn/aliases unchanged, and record its immutable URL.
Every possible default attachment target must be that safe bridge build, not old
e64ba73. Only then may the separately approved FUTURE build be staged without
domain assignment. If a transfer briefly selects CURRENT, www receives safe
handover responses rather than Learning Auth/session/payment handlers. Do not
assume domains-add plus alias-set is atomic. Verify the exact account workflow,
CURRENT pointer, bridge flag, project/root linkage and host-wide coverage first.
If any cannot be verified, STOP. Do not globally promote FUTURE and temporarily
repoint learn as a workaround. Future activation and bridge deployment are
distinct approvals, not implicit consequences of pushing the dormant source.

Freeze routine production deployments/redeployments for the approved window;
otherwise automatic domain assignment can overwrite manual pins. Any temporary
auto-assignment setting change needs explicit approval and a recorded restore
plan. Before resuming normal main deployments, review how every attached domain
will route in the common production build. Manual pinning is not a permanent
substitute for that review.

## Cutover/rollback checkpoints (not new authority)

1. Approve/release the sixteen-file dormant patch; verify learn and record both
   owners' immutable deployment/alias/configuration snapshots.
2. Careers completes provider-dashboard/pending-payment review and a measured
   Auth/application/payment drain. Retain original-origin receivers until clear.
   Careers accepts jobs referral/unsubscribe completion and sender behavior.
3. Complete actual old-install/PWA/push preflight and ownership acceptance. The
   existing synthetic Chrome rollback result remains valid for unchanged worker
   bytes, including Careers icon-only `dfb454a` as reported by Careers.
4. Verify account-specific staging, alias isolation, cron behavior and deployment
   freeze. After separate approval establish the bridge-enabled LEGACY CURRENT
   deployment as above; verify it before staging FUTURE or transferring anything.
5. Obtain explicit joint go/no-go. Transfer www ONLY to the reviewed FUTURE
   deployment. Confirm legacy routes, PWA update, Learning aliases and TLS before
   enabling/advertising new www Learning Auth flows.
6. Apply only separately approved Learning hosted Auth/Turnstile settings and
   templates in `qtcpjcaoptdunuefwvgc`. Keep original learn allowlist/callbacks.
   Keep Learning Paystack callback/webhook on their working learn endpoints and
   preserve modes, keys, references and retries; no automatic live-money switch.
7. After www validation, separately attach apex to Learning with the original
   307 -> www behavior. jobs stays Careers. No arbitrary DNS edits.
8. Verify both products, then submit each sitemap only after explicit SEO approval.
   No whole-www Careers change-of-address or blanket root redirect to jobs.

Rollback: stop new www Learning flows; keep jobs and learn online. Drain any new
www Learning Auth/payment flows before reassigning www, or get explicit acceptance
of safe restart rather than exchanging cross-project codes. Restore only recorded
domain/alias/configuration changes, using the exact Careers rollback deployment
and original-URL worker update path. Retain Learning's www receiver/allowlist as
long as in-flight flows need it. Restore apex if moved. Do not reset data, delete
subscriptions, clear storage, revoke accounts, rotate keys or replay POSTs.

Current decision: local compatibility/bridge release is proposed, NOT committed.
Account-specific alias/attachment execution is NOT certified yet,
and provider/drain/real-device gates still apply. No live transfer signoff.
