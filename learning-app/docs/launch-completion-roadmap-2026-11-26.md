# Growvelt Learning — pre-media completion roadmap

**Snapshot date:** 26 November 2026
**Scope:** Growvelt Learning only. Complete launch-critical product and hardening work before beginning media/streaming work.
**Production branch:** `codex/learning-production-git-release`
**Production-branch commit at snapshot:** `e047d5c9` (`Stabilize Learning PWA launch splash`)

This is the current roadmap and inventory snapshot. It supersedes older roadmap status statements where they conflict with the newer facts below; the older notes remain useful as historical test evidence. This document is a planning artifact only. It does not authorize merging, production changes, live refunds, or money transfers.

## Progress update — 26 November 2026

- Learning production branch now points at `e047d5c9` (`Stabilize Learning PWA launch splash`). The owner reports that the promoted splash fix is working. This worktree now also contains an unstaged, initial Live subscription provider slice; the pre-existing generated `learning-app/tsconfig.tsbuildinfo` edit and this untracked roadmap remain unstaged.
- Baseline reconciliation is anchored to the production branch, but the 73-file dirty readiness overlay still needs a file-by-file disposition before any of it is released. The deleted `images1/Chidimma .jpg` remains excluded pending an owner decision.
- **The reported missing manual subscription control is not a regression.** `/dashboard/subscriptions` is for viewing and managing subscriptions already held. A learner starts a subscription from an eligible course page. Production currently exposes only test-mode plan offers and a test-only checkout route; there is no Live learner subscription checkout path.
- The separate `41c36752` subscription candidate adds gated Live plan creation for instructors; it does not let learners start recurring billing. Its migration `20261201000000_add_live_subscription_plan_provisioning.sql` is future-dated in this snapshot, and the candidate branch also contains unrelated work. Do not promote that branch or migration as a whole.
- **One-time course checkout recovery is already implemented in production:** a new attempt is allowed after Paystack verifies `failed` or `abandoned` and the 30-minute safety window has elapsed. Unverified or pending results remain blocked to prevent duplicate charges. The dirty readiness overlay improves verification-error messages, but does not change this retry policy. Do not repeat the successful ₦100 purchase.
- **Focused code checks passed:** production `test:payments:unit`; candidate subscription checkout-core, management, Live plan-adapter, and isolated subscription lifecycle database tests. These results cover the candidate migration chain in an in-memory database; they do not establish that the candidate is deployed, the migrations are applied in hosted Supabase, or that Live learner checkout exists.
- **Read-only Cloudflare payout gate check:** the Learning Production Worker currently has `LEARNING_LIVE_PAYOUT_PROFILE_SETUP_ENABLED=true` and `LEARNING_LIVE_PAYOUT_BATCH_APPROVAL_ENABLED=true`. The separate external transfer submission gate is not present in the production variable list, so it remains off by default. No secret values were opened and no transfer was submitted. These settings do not make the payout candidate release-ready; its exact migrations and production data still need reconciliation.
- **Live subscription implementation starts from a Test Mode-only baseline:** the existing tables constrain subscription plans, subscriptions, invoices, and provider events to `payment_domain='test'`; the checkout reservation, callback recovery, and webhook parser also explicitly use Test Mode. The local first slice now adds a separate Live request builder, response parser, server initializer, and a dedicated opt-in gate that remains off unless explicitly set. No learner route calls it. Live-domain database reservations, callbacks, webhook processing, plan provisioning, and ledger handling are still required before this can be exposed or deployed.
- **Focused validation of the first Live slice:** the subscription checkout-core contract script passed, including Live request metadata and trusted checkout URL checks. TypeScript reports four errors only in stale generated `.next/types/validator.ts` imports (`AppRoutes`, `LayoutRoutes`, `ParamMap`, `AppRouteHandlerRoutes`); it did not report an error in the edited source files. The generated `.next` files were not changed.

## Current status

- **Live course checkout smoke test: passed.** On 26 November the owner paid **₦100** for a course and confirmed that the course became available to learn. Do not repeat a live charge as a test. This verifies one successful purchase and entitlement path; it does not by itself verify retries, refunds, every learner eligibility case, or subscription checkout.
- **Learning Cloudflare release branch is identified:** `codex/learning-production-git-release`. Its current tip is `e047d5c9` (`Stabilize Learning PWA launch splash`), and Cloudflare shows that release active at 100% traffic. The owner reports the promoted launch screen works.
- **The November 8 roadmap is stale.** It describes checkout and Cloudflare production as not yet complete. The successful purchase above supersedes that checkout status.
- **Three distinct code states must be reconciled before any broad release.** The dirty `codex/company-live-readiness` checkout is not the production branch. A subscription/refund candidate is on GitHub `main` but not on the Learning production branch. A second refund foundation has two commits not pushed to its remote branch.
- **No files in the audited worktrees were staged by this inventory.** The user’s local work is preserved. No build or test was run for this roadmap update.
- **Email Center broadcasts remain on hold.** The owner asked that instructors, learners, and admissions not receive campaign email before launch. Do not send a list or test broadcast while completing this roadmap.

## Work plan and release gates

### 0. Reconcile the release baseline and protect local work — first

1. Keep the Cloudflare production target on `codex/learning-production-git-release`; do not push the dirty readiness branch wholesale.
2. Compare the production branch, the `codex/company-live-readiness` snapshot, and the two financial feature branches by commit and file. Mark every path as **release candidate**, **defer**, or **needs owner decision** before staging anything.
3. Review each release slice from the production baseline and bring over only its required files and migrations. Do not use `git add -A` across these worktrees.
4. Keep the nested `tmp/`, `learning-cloudflare-poc/`, `learning-cache-release/`, `learning-payout-batching/`, and recovery preview trees quarantined. They contain copies, build output, scripts, assets, or nested repository data and may include local-only material. Do not recursively stage, upload, or delete them as cleanup.
5. Resolve the deleted `images1/Chidimma .jpg` entry with the owner before considering that deletion for a commit. Exclude generated `tsconfig.tsbuildinfo` and generated `next-env.d.ts` changes unless a source-level reason is confirmed.

**Exit gate:** the exact candidate diff is based on the Cloudflare production branch, has no unrelated or temporary files, and all database migrations are listed in apply order.

### 1. Finish subscriptions and course-payment recovery — next product phase

The one-time course purchase is verified. Subscription lifecycle behavior is a separate unfinished launch slice.

1. **Resolved:** `/dashboard/subscriptions` is the learner's subscription management page, not a manual purchase form. Keep purchase on eligible course pages; do not add a separate manual subscription action.
2. Build the missing Live learner subscription checkout path separately from instructor plan creation. Keep it gated off until subscription callback/webhook verification, duplicate-event idempotency, entitlement start/expiry, cancellation/manage links, failure recovery, and test coverage are complete.
3. Review the gated Live plan provisioning and subscription refund/reversal work in the candidate commits. Confirm the feature gates default safely and that refunds cannot run from a page or route without the intended role, ownership, and recorded approval.
4. Verify the existing one-time abandoned-checkout recovery with fixture/provider test mode. Keep the 30-minute wait after a provider-confirmed failure/abandonment; unknown or pending results must not start a second charge. Do not create another live charge.
5. Review the SQL dependencies and migration order before any hosted apply. Preserve current subscription records and do not apply production migrations as part of a code-only release.

**Exit gate:** focused automated and UI checks pass for the subscription lifecycle and checkout recovery; production configuration is verified by variable name without exposing secret values; the manual-subscription decision is documented; no live refund has been used as a test.

### 2. Complete instructor payout readiness and financial controls

Payout readiness is not established by the successful learner purchase. Keep transfers disabled until this gate is complete.

1. Locate and review the payout-batching implementation and reconcile it with the instructor payout profile, instructor earnings, admin approval, and payment ledger paths.
2. Verify payee ownership and profile validation, available-balance calculation, fee/refund/chargeback handling, minimums, currency, batch totals, approval permissions, duplicate prevention, retry behavior, transfer status reconciliation, and audit history.
3. Confirm failed, pending, reversed, and partially completed batches recover safely and cannot pay an instructor twice. Exercise with mocked/provider test mode and database fixtures only.
4. Verify payout and refund feature gates and production secrets by name. Do not enable a live transfer or send money as a test.
5. Determine whether the existing provider path and database schema support the requested launch payout flow; record any remaining provider dashboard setup separately from code readiness.

**Exit gate:** payout accounting and authorization evidence is complete, migration dependencies are known, and an explicit operator release procedure plus rollback/reconciliation procedure exists. Any real transfer remains a separately authorized financial action.

### 3. Close Phase 6 launch hardening — headers, boundaries, recovery

Phase 6 is **partially complete**, not signed off. Existing `phase6-launch-hardening.md` records prior work on security headers, request-origin/body boundaries, durable public-intake quotas, navigation, and communications protections. It also records remaining limits and local-only evidence. Reconcile that history with the current Cloudflare production release.

1. Verify the current Learning production responses on the canonical Learning hostnames for the intended security headers, HTTPS/redirect behavior, callback privacy headers, and cache policy. Do not assume an old local response proves the current Worker behavior.
2. Review the current dirty `proxy.ts`, `site-urls.mjs`, and domain-transition checks for authentication redirects, allowed origins, retained Learning hostnames, and cross-site isolation. Confirm webhook exceptions remain intentional.
3. Refresh dependency/security findings and review authorization for payment, refund, subscription, payout, admin, and company routes.
4. Reconcile applied versus unapplied Supabase migrations, current Worker variables/bindings by name, scheduled jobs, monitoring, incident steps, and rollback version.
5. Complete responsive, keyboard/focus, contrast, error-state, and PWA/offline/update checks for the actual release candidate. Keep performance work lightweight and avoid production load tests.

**Exit gate:** there is a written list of verified hosted behavior, local-only evidence, remaining gaps, environment-variable names, migrations, monitoring, and rollback steps. No unresolved critical access-control or financial-integrity issue remains.

### 4. Review remaining local Learning experience and communications changes

1. Review course, company workspace, admin promotions/payment recovery, FAQ, payout profile, and subscription UI modifications against the owner-approved behavior and responsive layouts.
2. Review new PWA controls, launch splash, install button, pull-to-refresh, screenshots, and the untracked `ui-review/` pages. Include only code that is referenced, necessary, and accepted; keep unrelated visual experiments and sample assets out.
3. Reconcile the modified Email Center runtime, payment notifications, and Supabase auth templates. Account/security and transactional messages can be reviewed separately from campaign broadcasts.
4. Keep instructor/learner/admissions campaign sends paused at the owner’s request. Do not test by emailing a real audience. Preserve existing successful login-alert evidence without re-sending it unnecessarily.

**Exit gate:** every accepted UI or email slice has a scoped diff and relevant checks; no unapproved campaign is sent; all unused experiments and sample media remain out of the release.

### 5. Release slices to Learning production, then verify

1. Prepare a clean candidate from the production branch for one approved slice at a time: subscription/recovery, payout controls, Phase 6, then any remaining accepted experience work.
2. Run the focused checks and production build for that slice; review migration requirements and configuration before upload.
3. Push to the Cloudflare-connected Learning branch only. Confirm the expected build is Ready, inspect the active version and bindings, and verify the affected live behavior without making another payment or sending money.
4. Record the commit, deployment/version, smoke evidence, and rollback target in the release ledger. Update this roadmap and inventory after each slice.

**Exit gate:** all accepted launch-critical work is either released and verified or explicitly deferred with an owner-visible reason. Only then start media/streaming selection and integration.

## Git/worktree snapshot

| Worktree / branch | Snapshot | Interpretation |
|---|---|---|
| `C:\Users\HP\.codex\worktrees\learning-cloudflare-git-pipeline\Leo website` — `codex/learning-production-git-release` | `e047d5c9`, tracking origin; only generated `learning-app/tsconfig.tsbuildinfo` and this untracked roadmap are present | Cloudflare production release baseline. Do not include generated build metadata. |
| `C:\Users\HP\Projects\Leo website` — `codex/company-live-readiness` | 92 status entries: 73 tracked changes/deletion and 19 untracked paths/trees; none staged | Main local backlog. It is not the Cloudflare production branch. Inventory is below. |
| `C:\Users\HP\Projects\Leo website\learning-payout-batching` — `codex/instructor-payout-batching` | 9 commits ahead of its configured `origin/codex/instructor-payout-batching`; branch tip `41c36752` is also on `origin/main`. Two more local modifications: the Phase 4 provider-plan test and generated `tsconfig.tsbuildinfo`. Not an ancestor of Learning production. | The work is pushed to GitHub `main`, but not to the Cloudflare production branch. It contains gated subscription plan/refund work and UX changes; review and selectively port. Its branch name alone does not prove payout batching is complete. |
| `C:\Users\HP\.codex\worktrees\payment-email-first-name\Leo website` — `codex/live-instructor-payout-foundation` | 2 commits ahead of its remote; tip `4d33292e`; not an ancestor of Learning production | Unpushed refund/reconciliation foundation and migrations. Review separately; do not combine with payout-batch or subscription activation without dependency review. |

### Candidate commit history to reconcile

`codex/instructor-payout-batching` (already reachable from `origin/main`, not Learning production):

- `d7bbb432` Simplify instructor commercial earnings workspace
- `ed569683` Keep commercial recovery button compact on mobile
- `3f878655` Use Lucide chevron for commercial operations disclosure
- `f231d8f0` Move Create Course above My Courses
- `36881bc7` Add gated Live subscription refund operations
- `81c8944f` Record gated subscription refund deployment status
- `db565cfe` Scope subscription management to active provider domain
- `ac7df76a` Prepare gated Live subscription plan provider adapter
- `41c36752` Add gated Live subscription plan setup

This branch diff contains 46 files and four SQL migrations. The migrations include subscription invoice earnings source, live subscription refund reversal, provider-domain subscription management, and Live subscription plan provisioning. Review their dependencies and deployment status before porting.

`codex/live-instructor-payout-foundation` (not pushed to its branch remote):

- `ed2df022` Reconcile full live refund charges safely
- `4d33292e` Require explicit absence before closing a live refund case

This branch diff contains eight files, including a fee-inclusive live full-refund migration and SQL checks. It is refund work, not evidence that payout batching itself is complete.

### Additional branch ancestry check — 26 November

- `codex/company-live-readiness` tip `1eaa0145` is an ancestor of production commit `1b47a301`. Its baseline is therefore already in the production branch; the 92 working-tree entries listed above are changes after that baseline and remain uncommitted.
- `codex/learning-refund-release-review` tip `7c81f762` is also an ancestor of `1b47a301`. The code represented by that review commit is in the production branch history. This does **not** prove that the latest production deployment is serving it or that a live refund was exercised.
- `codex/live-instructor-payout-foundation` tip `4d33292e` is a different two-commit line and is not an ancestor of production. Its refund changes overlap in purpose with the already-merged refund-review line; compare the actual diffs before porting anything to avoid duplicating or reverting the production version.
- `codex/staged-learn-to-www-redirect` tip `f9c5104c` exists on GitHub but is not an ancestor of the production branch. Verify current Learning redirects before deciding whether it remains needed.
- `codex/learning-cloudflare-git-pilot` tip `358cb20d` is a staging-only line, not an ancestor of production. Keep its staging configuration out of the production release.
- `codex/payment-email-first-name` tip `5603994a` is already reachable from `origin/main`, not from production. Check whether its change is still desired and port it only if it has not been superseded.
- Local `main` is reported 192 commits behind `origin/main`; do not use this stale local branch as a merge base.

These ancestry checks narrow the first step: the working baseline is the current production branch, which already contains the latest readiness and refund-review **commits**. The work still to review is the dirty readiness diff, the subscription branch’s production delta, the separate unpushed refund foundation, and any redirect/email changes that are not already present.

## Exact uncommitted inventory on `codex/company-live-readiness`

Snapshot command: `git status --short --untracked-files=normal` in `C:\Users\HP\Projects\Leo website` on 26 November 2026. The entries below are an inventory, not an instruction to release them.

### Tracked edits and deletion (73 entries)

**Checkout, subscriptions, and payment operations**

- `images1/Chidimma .jpg` — deleted; owner decision required before release.
- `learning-app/app/api/company/workspaces/[workspaceId]/purchases/[purchaseId]/checkout/route.ts`
- `learning-app/app/api/payments/paystack/initialize/route.ts`
- `learning-app/app/api/payments/paystack/reconcile/route.ts`
- `learning-app/app/components/company/payment-return-check.tsx`
- `learning-app/app/components/learning/enrollment-button.tsx`
- `learning-app/app/components/learning/subscription-payment-return-check.tsx`
- `learning-app/app/components/learning/subscription-plan-purchase.tsx`
- `learning-app/app/components/payments/learner-payment-return-check.tsx`
- `learning-app/app/dashboard/courses/[slug]/page.tsx`
- `learning-app/app/dashboard/subscriptions/page.tsx`
- `learning-app/app/dashboard/test-subscriptions/[planId]/page.tsx`
- `learning-app/app/lib/payments/learning-test-subscription-checkout.ts`
- `learning-app/app/lib/payments/paystack-core.ts`
- `learning-app/app/lib/payments/paystack-subscription-core.ts`
- `learning-app/app/lib/payments/paystack-subscriptions.ts`
- `learning-app/app/lib/payments/paystack.ts`
- `learning-app/app/payments/paystack/callback/page.tsx`
- `learning-app/scripts/test-phase1a-paystack.mjs`
- `learning-app/scripts/test-phase4-subscription-provider-plan.mjs`

**Payout, refunds, and admin/company controls**

- `learning-app/app/api/instructor/payout-profile/route.ts`
- `learning-app/app/components/admin/commercial-payout-transfer-control.tsx`
- `learning-app/app/components/admin/payment-recovery-button.tsx`
- `learning-app/app/components/admin/payment-refund-control.tsx`
- `learning-app/app/components/company/workspace-controls.tsx`
- `learning-app/app/dashboard/admin/commercial/page.tsx`
- `learning-app/app/dashboard/admin/page.tsx`
- `learning-app/app/dashboard/admin/payments/page.tsx`
- `learning-app/app/dashboard/admin/promotions/page.tsx`
- `learning-app/app/dashboard/company/billing/page.tsx`
- `learning-app/app/dashboard/company/page.tsx`
- `learning-app/app/dashboard/instructor/payout-profile/page.tsx`
- `learning-app/app/lib/admin/payment-operations.ts`
- `learning-app/app/lib/learning/account-workspace.ts`
- `learning-app/app/components/admin/operations.module.css`

**Instructor UI, communication routes, and shared site behavior**

- `learning-app/app/api/learning/admin/emails/route.ts`
- `learning-app/app/components/admin/course-moderation-form.tsx`
- `learning-app/app/components/faq-page-content.tsx`
- `learning-app/app/components/instructor/payout-profile-form.tsx`
- `learning-app/app/components/instructor/provision-subscription-test-plan-button.tsx`
- `learning-app/app/components/instructor/subscription-plan-form.tsx`
- `learning-app/app/dashboard/instructor/subscriptions/actions.ts`
- `learning-app/app/dashboard/instructor/subscriptions/page.tsx`
- `learning-app/app/lib/email/email-center-runtime.ts`
- `learning-app/app/lib/email/payment-notifications.ts`
- `learning-app/app/lib/site-urls.d.mts`
- `learning-app/app/lib/site-urls.mjs`
- `learning-app/proxy.ts`
- `learning-app/scripts/test-learning-domain-transition.mjs`
- `learning-app/scripts/test-learning-www-bridge.mjs`
- `learning-app/scripts/test-phase1b2c-policy-app.mjs`
- `learning-app/scripts/test-phase1e1-payout-profile-app.mjs`

**Docs, auth templates, generated files, and repository instructions**

- `learning-app/.gitignore`
- `learning-app/AGENTS.md`
- `learning-app/docs/learning-email-center-upgrade.md`
- `learning-app/docs/phase4-enterprise-contract-register-design.md`
- `learning-app/docs/phase6-launch-hardening.md`
- `learning-app/docs/roadmap-status-2026-10-06.md`
- `learning-app/next-env.d.ts`
- `learning-app/tsconfig.tsbuildinfo`
- `learning-app/supabase/email-templates/change-email-address.html`
- `learning-app/supabase/email-templates/confirm-sign-up.html`
- `learning-app/supabase/email-templates/email-address-changed.html`
- `learning-app/supabase/email-templates/invite-user.html`
- `learning-app/supabase/email-templates/magic-link-or-otp.html`
- `learning-app/supabase/email-templates/mfa-method-added.html`
- `learning-app/supabase/email-templates/mfa-method-removed.html`
- `learning-app/supabase/email-templates/password-changed.html`
- `learning-app/supabase/email-templates/phone-number-changed.html`
- `learning-app/supabase/email-templates/reauthentication.html`
- `learning-app/supabase/email-templates/reset-password.html`
- `learning-app/supabase/email-templates/sign-in-method-linked.html`
- `learning-app/supabase/email-templates/sign-in-method-removed.html`

### Untracked entries (19 status entries)

- `learning-app/app/components/pwa/GrowveltAppControls.tsx`
- `learning-app/app/components/pwa/GrowveltLaunchSplash.tsx`
- `learning-app/app/components/pwa/InstallGrowveltButton.tsx`
- `learning-app/app/components/pwa/PullToRefresh.tsx`
- `learning-app/app/ui-review/`
- `learning-app/docs/cloudflare-local-functional-database-plan-2026-11-10.md`
- `learning-app/docs/launch-completion-roadmap-local-first-2026-11-08.md`
- `learning-app/docs/local-work-inventory-2026-11-08.md`
- `learning-app/docs/public-cache-policy-local-first-2026-11-08.md`
- `learning-app/docs/release-ledger-local-first-2026-11-08.md`
- `learning-app/docs/roadmap-outstanding-work-2026-10-27.md`
- `learning-app/public/images/white-beautiful-lady.png`
- `learning-app/public/pwa/screenshots/`
- `learning-cache-release/`
- `learning-cloudflare-poc/`
- `learning-payout-batching/`
- `recovery-redirect-preview/`
- `recovery-status-preview/`
- `tmp/`

The listed directories are intentionally inventoried at directory level. Their nested files include temporary builds/copies, scripts, screenshots/media, or recovery artifacts; inspect specific files only when a roadmap slice requires them. None should be bulk-added.

## What happens next

The production baseline is now reconciled at `e047d5c9`, and the manual-subscription question is resolved. Continue with **Phase 1: Live learner subscription checkout and recovery**. First implement and test the disabled-by-default Live learner path; keep existing one-time course checkout as verified. Then review **payout/refund controls**, close **Phase 6 hardening**, and triage the remaining local work. Media/streaming begins after those gates are closed or explicitly deferred.
