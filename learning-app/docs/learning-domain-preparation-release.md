# Learning domain-preparation release — 18 October 2026

The owner approved an isolated preparation-only push to `main`. The approved
baseline is `35021b7`; remote `main` matched it before staging. This is NOT the
coordinated domain cutover. Earlier audit/preparation documents retain their dated
historical observations; the cutover and unresolved-route runbook still applies.

## Release boundaries

- Keep Learning canonical/default origin `https://learn.growvelt.com` and current
  Careers-link default `https://www.growvelt.com`. New URL settings are commented
  examples only; no environment-value, DNS, Vercel-domain or hosted setting change.
- Future behavior additionally requires
  `NEXT_PUBLIC_LEARNING_DOMAIN_CUTOVER_ENABLED=true` at build time. Missing,
  false or other values keep Learning on learn even if a future URL was
  preconfigured. Do not enable this switch in the preparation deployment.
- Future-www aliases and old-Careers compatibility are preparation code, gated by
  explicit future URL configuration. No future host setting is enabled by this push.
- Keep Learning Auth and Paystack endpoints, credentials, keys, modes, checkout
  gates, webhook verification and existing records. No hosted end-to-end write test,
  synthetic user creation, checkout, email send, Storage write or migration push.
- Local Supabase Auth template source changes are versioned preparation only;
  repository push does not upload them to the hosted Learning Auth service.
- No Careers application edits, deployment or settings. Compatibility code lives
  in Learning solely for requests it will receive after a separately approved handover.
- Exclude the unrelated image deletion, enterprise-design note, tsbuildinfo,
  untracked media, temporary UI-review route and pre-existing PWA files. The
  generated compatibility worker is not those unrelated public PWA files.

## Review and verification

Stage only reviewed URL, Auth/Link/API alias, email/SEO, payment-guard, future
compatibility, local-test and transition-document changes. Test the staged snapshot
without the dirty workspace's untracked files. The isolated builds use loopback and
blank backend credentials; no `.env.local` or secret file enters the archive/commit.

The Auth template preservation test now compares against fixed release `35021b7`
rather than `HEAD`, so it remains valid after committing. The public-support copy
fixture also uses that shipped baseline instead of the older `2e4b537`, preserving
the owner's already-approved copy and the existing inquiry handler exactly. These
are test-baseline fixes, not product-copy or UI changes.

After passing checks, create one preparation commit and fast-forward only that
commit to remote `main`. Verify Vercel's resulting deployment and public read-only
Learning smoke checks. Do not promote a future-www configuration or assign domains.
If deployment verification is unavailable, report it rather than assuming Ready.

### Verified before commit

- All 17 Phase 5 presentation suites passed; the teaching-entry fixture loader
  now resolves the compatibility module explicitly. No UI layout/copy was changed.
- Domain/default-off gating, exact compatibility, Auth session, strict Paystack
  configuration, subscription checkout and management regressions passed.
- Disposable Chrome PWA/update/offline/mobile and redirect-token/referrer tests passed.
- The staged-code snapshot (without unrelated PWA/review routes or `.env.local`)
  passed the optimized legacy/default build, TypeScript and loopback HTTP rehearsal.
  A dependency junction was rejected by Turbopack, so the successful snapshot uses
  actual copied package files. No production build configuration was weakened.
- Targeted production/domain/test lint: zero errors; seven pre-existing raw-image
  warnings. Existing Node module-type warnings remain in direct TypeScript tests.
- Full future-host build/preflight with the final approved settings remains a
  cutover gate; the new default-off switch itself is covered by the unit matrix.

Known-good Learning rollback: commit `35021b7cd3e765b5bd04b92e69ab9f7fba1893ed`,
Vercel deployment `FQs3fcb4GS7ps3pMWZt5NbDGL2Mx`. GitHub's Vercel status reports
successful completion for that baseline. Retain it; no rollback or domain action
was performed during preparation.

## Next gate

The jobs/www/learn joint cutover remains blocked on Careers-owned special-link,
Auth/reset and installed-PWA/push/rollback decisions described in
`learning-careers-compatibility-runbook.md`. This preparation release does not
declare those gates complete or advance the unfinished Learning Phase 5 roadmap.
