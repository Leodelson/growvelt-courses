# Learning Email Center — bounded live broadcast release

## Provider setup and controlled delivery — 23 October 2026

The owner approved activation, creation of a dedicated Full-access Learning
Resend key and saving it as a server-only Learning Production secret. The key
was created as `Growvelt Learning Email Center`; the owner saved its one-time
value as `RESEND_MARKETING_API_KEY`. Vercel confirms the Production Secret entry;
the value was not printed, stored in source or copied from Careers. Existing
keys and Careers configuration were unchanged. Resend Full access is team-wide,
not a provider-enforced Learning-only permission boundary.

Ten non-secret Learning Production variables were saved: five sender mailboxes,
the reserved Learning segment, verified `growvelt.com`, recovery enabled,
controlled-test mode and the owner-only recipient allowlist. Known-good source
`55a2948` was redeployed as Ready/Current Production
`kUiy65ohYy4hoxCwCYRNx3LSJzfK`, without publishing unrelated local work.

Read-only provider verification: `growvelt.com` and `updates.growvelt.com`
Verified; Free usage 1/100 daily transactional, 156/3,000 monthly, 592/1,000
contacts, 3/3 segments; paid overages remained disabled. The owner's existing
globally subscribed contact was reused, without import or resubscription.
Learning's actual recipient review confirmed their saved marketing opt-in.

Exactly one approved test was sent from `Growvelt Learning <no-reply@growvelt.com>`
to `nduleonardc@gmail.com`, subject `Growvelt Learning email test`, using the
previously approved body. Draft `0d1e7fa1-93e2-4b09-8304-2ad4a2ef4341`, provider
broadcast `dfae45b7-ebb1-46b6-86e0-4f0309d507b4`: Resend reports Sent, 1 delivered,
0 bounced, 0 suppressed. Learning's no-resend reconciliation subsequently
recorded `sent / provider sent` and draft `accepted`; the segment lease is
released only by that verified terminal transition. No other campaign was sent.
This is provider delivery evidence, not a claim to have inspected the inbox.

After the successful test, the owner separately approved normal admin-reviewed
broadcasts to at most 100 explicitly opted-in Learning accounts per campaign.
The release contract is `LEARNING_EMAIL_CENTER_RELEASE=admin-live` plus an
explicit `LEARNING_EMAIL_CENTER_LIVE_MAX_RECIPIENTS=100` (valid range 1–100).
Missing/invalid caps, an unknown release mode or any non-Learning segment leave
sending disabled. Controlled-test mode retains its independent ten-address
allowlist. Both modes retain the two confirmed operators plus Learning admin
RPC, current confirmed identities/consent, exact immutable 15-minute approval,
global suppression, exact provider membership and fresh free-plan checks.

This does not activate unattended scheduling, automatic contact creation,
webhooks, notification-bell delivery or push. A missing opted-in provider
contact stops preparation before writes and requires a separately approved
import. Account/support notices remain capped at ten and require their existing
separate short-lived transactional budget allocation; zero defaults were not
raised. This release is bounded live **broadcasts**, not all delivery channels.
Shared Resend global unsubscribes can also suppress Careers; no global opt-out
was toggled for this test. Product opt-outs continue to be checked from Learning.

Activation rollback: set the release gate to `disabled`, leave recovery enabled,
redeploy known-good source, reconcile existing IDs without another send, and
preserve tables/claims/provider records. Previous sending-off deployment:
`4Eq5HFizd3j1Ps8Fpu16PRhzMrPk`. No role grants, hosted Auth, payment, DNS, domain,
Careers, or billing settings changed. Phase Six and Live financial gates remain
open. Earlier sections below are dated history superseded by this checkpoint.

## Approved release checkpoint — 23 October 2026

The owner explicitly approved the three Learning migrations and an isolated
push/deployment **with sending disabled**. All three migrations have now been
applied to Learning project `qtcpjcaoptdunuefwvgc`, one transaction at a time,
with their version/name/source recorded atomically in migration history.
An initial editor-replacement error was rejected before any schema changes;
a read-only check confirmed zero partial tables/history before the corrected
execution. Subsequent source-hash checks match all three local migration files.

Post-apply production verification: 13 accounts unchanged; 12 new RLS-enabled
tables; zero anonymous/authenticated table privileges or new-function execute
grants; all 17 intended service-role functions available. Drafts, attempts,
broadcast operations and release approvals are empty. Budget limits remain
zero, approval expiry is null, and the segment lease is free. No consent,
contacts, messages, provider settings, payment/Auth settings or Careers data
were changed. Final production build/TypeScript passed before the isolated push.

This checkpoint authorizes deployment only, not broadcast activation. The
marketing key/sender configuration, saved owner opt-in and controlled real
provider test remain separate prerequisites. The pre-release local checkpoints
below are retained as dated history, not current claims that migrations remain
unapplied. Deployment readiness is verified separately after the push.

The isolated release `08374c5` reached Vercel Ready/Production deployment
`7PFdJCPNo8wNp2BkUYDB8Tb3gQw9`. The live access check found that the finite
Careers compatibility inventory also owns `/dashboard/admin/emails`. A narrow
follow-up adds Learning's explicit `/learning/dashboard/admin/emails` alias;
existing Learning navigation uses the shared link helper and follows that alias.
The original www path remains Careers-owned, while learn keeps its original
path. Regression checks cover link generation, safe sign-in return, authenticated
proxy rewrites/cookies, old Careers routing and the learn route. Sending gates
and provider configuration remain unchanged and disabled.

## Local build checkpoint — 23 October 2026 (before approved release)

The local broadcast worker, protected HTTP actions, exact-recipient release
approval and recovery/history controls are now connected. Three new migrations
remain **unapplied**, and the complete upgrade remains **unpushed**. No real
message, contact import, or production release has been performed.

- Broadcast preparation exclusively leases the reserved Learning segment,
  checks complete paginated provider contacts, changes only Learning segment
  membership, verifies the exact eligible set, creates an unsent provider draft,
  and durably stores its ID before any dispatch. Careers segments and global
  unsubscribe state are never written. Missing contacts stop before the lease;
  no automatic create/upsert/re-subscribe is implemented.
- A separate final approval binds the saved revision and sorted exact recipient
  emails for 15 minutes. The first-release server gate only accepts
  `LEARNING_EMAIL_CENTER_RELEASE=controlled-test`, the reserved segment ID and
  a nonempty allowlist of at most ten addresses. Consent still applies. Each
  prepare/send rechecks the current confirmed Learning identity and consent.
- Dispatch is claimed durably before the sole provider send request. Provider
  content/name/segment must match the saved renderer. Lost replies are never
  automatically retried. A unique exact operation lookup can recover a lost
  create response; dispatch recovery reads the existing provider status only.
- Queued/unknown operations retain segment ownership. Only verified sent or
  canceled terminal status releases it. Cancellation after a local opt-out
  remains possible; already-sent messages cannot be recalled. Reconcile/cancel
  can remain available with new sending disabled using the separate server-only
  `LEARNING_EMAIL_CENTER_RECOVERY=enabled` gate.
- Account notices use the existing claim/budget/usage/checkpoint worker and the
  same exact release approval. Their history exposes accepted/uncertain/skipped
  states. Missing provider IDs and interrupted membership writes stay quarantined
  for operator evidence-based recovery; no UI “clear and retry” shortcut exists.
- API rate pacing is serial per adapter instance (250 ms) with no automatic
  retries. This is not an account-wide rate limiter or an atomic shared Careers
  quota reservation. Account notices retain zero-default short-lived caps and
  conservative fresh provider headroom. Coordinate the test window with Careers.
- Marketing personalization remains a neutral greeting; the preview's example
  name is not a promise of provider personalization. Bell/push, contact import,
  background consent scheduling, global provider webhook reconciliation, and
  automatic recovery from unverifiable outcomes are **not activated**. Broad
  unattended marketing release is not approved by this bounded test gate.

Read-only hosted audit on 23 October: Learning project
`qtcpjcaoptdunuefwvgc` has **13 accounts, 13 confirmed, 0 confirmed opted-in
Learning accounts**; the owner's marketing preference is false. The audit used
only SELECT; no consent was manufactured. Resend's Learning segment still has
0 contacts/0 unsubscribers. Existing Careers segments remain 592/24 and 586/24.
Signup, role, owner permission, and a small list do not constitute recipients'
marketing consent. The first proposed live test is the owner account only after
self opt-in and exact send/import approval. Do not test on all 13 users.

The owner subsequently approved using **only nduleonardc@gmail.com**, and said
they will enable Learning marketing emails. This is not yet a verified saved
opt-in. Approved test subject: “Growvelt Learning email test”; body: “This is a
controlled test of Growvelt Learning’s Email Center. No action is needed.”
The actual Learning sender address, release/migrations and any contact import
still need verification/approval before a real send.

Read-only Vercel inventory in `growvelt-learning`: `RESEND_API_KEY` exists for
Production/Preview as a secret. Searching `RESEND` returned only that entry;
`RESEND_MARKETING_API_KEY` and the Learning segment variable are not yet saved
there. Searching `FROM` returned no sender variables. No values were revealed
or changed. Existing Learning login/payment emails use
`no-reply@growvelt.com` in source; the new Email Center intentionally requires
explicit approved sender configuration rather than silently falling back.
Suggested Learning test identity is `Growvelt Learning <no-reply@growvelt.com>`
on the already verified domain, subject to owner/configuration approval. Do not
confuse absent new variables with a broken existing transactional mail system.

Current Ready Production reference verified in Vercel on 23 October:
`GDNd28CcC7YWkQzZaSQdTmPCqik3`, source
`bbc2e9b5f76e67290cddc1e2fca5876407d867fd` on `main`, deployment host
`growvelt-learning-81xpuo7xb-leodelsons-projects.vercel.app`.
This records evidence only; no rollback/deploy/domain action was taken.

Additional local test: `npm run test:email-center:broadcast` executes all three
real migrations in isolated PGlite with the actual worker/HTTP adapter and fake
Resend: missing-contact preflight, exact/expired approvals, duplicate claims,
lost create/send replies, no blind redispatch, queued isolation, opt-out
cancellation, changed-content quarantine, unsafe-transition denial and RLS.
Production build and TypeScript pass. This is not a real provider delivery test
or multi-session PostgreSQL concurrency certification.

Browser fixture subsequently passed the full saved draft → branded preview →
consent review → exact-recipient approval → fake queued dispatch → no-resend
reconciliation → cancellation → history after reload flow. In-page confirmation
dialogs focus the safe Back action, support Escape and trap keyboard focus.
320/390 px checks had equal content/scroll widths (305/375 px respectively),
with no console warnings/errors. Browser's temporary viewport was reset. All
provider operations in this harness are fake and all accounts disposable/local.

### Coordinated release / controlled test (approval still required)

1. Record the current and rollback Ready Learning Vercel deployment IDs and
   source SHA; isolate this upgrade from unrelated PWA/assets/roadmap/template
   edits. Verify operator/admin access, domains and actual sender addresses.
2. Obtain explicit approval for the three named migrations, isolated push/deploy
   with **both activation gates disabled**, and the exact controlled-test plan.
   Apply only these migrations to the verified Learning project, then verify
   service-only grants, function signatures and unchanged account totals.
3. Verify Learning's own server-only transactional/marketing credentials belong
   to the approved shared team and can read usage/contacts/broadcasts. Do not
   copy Careers credentials or reveal keys. Check the actual sender aliases,
   including singular `partnership@growvelt.com`, and current free-plan usage.
4. Have the owner opt in through Learning settings. Read back consent, confirmation
   and actual provider global suppression. Prepare an exact existing/missing
   contact plan; obtain approval before importing any address into Resend. Do
   not clear global suppression or upsert `unsubscribed:false` into an existing
   shared contact. If safe create-only behavior cannot be established, pause
   for a reviewed manual import instead of guessing.
5. Coordinate a quiet shared-provider window with Careers. Set the controlled
   recipient allowlist to the single approved owner address, verified domains,
   and the controlled-test gate only after prerequisites pass. For an account
   notice, separately approve at most one short-lived quota reservation; do not
   use transactional mode to bypass marketing consent.
6. Save/preview/review the exact subject/body/sender, prepare the unsent broadcast,
   verify provider content and actual eligible membership, approve exact release,
   and explicitly confirm the one live send. Record provider ID/status, inspect
   the real mailbox, and test unsubscribe without affecting Careers subscriptions.
7. Reconcile until verified sent/canceled, preserve evidence, and disable new
   sending again. No general audience expansion or Phase Six closure is implied.

Rollback: disable the sending gate first, retain recovery-only access, cancel
verified queued remainder where supported, reconcile existing IDs without
resending, and preserve all claims/leases/audit tables. Never clear uncertain
claims or drop these tables to retry. A sending-off compatible deployment is
safer than restoring the old unguarded per-recipient marketing route. Resume
only after consent/provider state is reconciled. No hosted rollback was run.

22 October 2026. Owner approved the Learning-only upgrade after the Careers
handoff, specified the two email operators, and asked to retain existing email
branding. The application remains local/unpushed; no production migration,
contact sync, send or deployment has occurred. The sole approved provider change
is the later rename of empty General to Growvelt Learning, recorded below.

## Implemented locally

- Internal `/dashboard/admin/emails` remains internal. The page and API require
  a verified Supabase user with a confirmed email matching one of the two
  specified operators **and** the existing database-backed Learning admin RPC.
  The addresses live in a server-only module, not the client-shared model.
  This does not create accounts or grant platform-wide admin roles.
- Responsive purple header, sender/audience selection cards, desktop preview
  sidebar, mobile stacking, formatting toolbar, subject, optional headline,
  first-name greeting and optional HTTPS Growvelt CTA. Small formatting grammar
  supports bold, italics and bullet lists; raw HTML, images, scripts and video
  are escaped text. No new editor dependency or paid service was installed.
- Server-rendered sandboxed preview uses the existing Growvelt renderer,
  wordmark, dark email layout, centered CTA and footer. Existing transactional
  callers preserve their prior paragraph rendering. The first-name preview is
  explicitly an example; provider personalization is not yet wired.
- Stable draft UUIDs, persisted content/revisions, optimistic concurrency,
  same-request save retry deduplication, editable reviews and locked sending
  content. Editing invalidates recipients and local preview/review state.
  Draft switching warns before discarding unsaved text.
- Recipient snapshots from **Learning** auth/profiles only: all opted-in users,
  learners, approved instructors, active company owners/admins, or selected
  existing emails/UUIDs. Addresses deduplicate; unknown references reject the
  review. Marketing requires explicit Learning consent. Account/support mode
  requires selected existing users (at most ten); message classification still
  requires administrator judgment, not a role/count shortcut.
- Partnerships is a sender identity. Partnership inquiry addresses do not
  automatically acquire accounts, marketing consent or recipient membership.
- New service-only RLS tables and save/review/claim/checkpoint functions in
  `20261107000000_add_learning_email_center_drafts.sql`. This migration has
  **not** been applied to hosted Supabase. Existing campaign/delivery records,
  preferences, subscriptions, users and permission grants are preserved.
- Durable unique attempt claims never expire into automatic retries. Consent
  and current confirmed email are rechecked before claim. Accepted checkpoints
  are idempotent; uncertain/skipped results pause the campaign for review.
  The provider-independent contract and the internal transactional worker are
  tested with real local SQL/RPC mapping and a fake HTTP transport. The HTTP
  send action is still closed; this is not a production sending activation.
- A server-only Resend HTTP adapter now supports single-recipient transactional
  requests with stable idempotency keys and **draft-only** broadcast creation.
  It requires explicitly supplied credentials, verified sender domains and an
  explicit provider-write gate (default off). Requests use a fixed HTTPS API
  origin, reject redirects, time out and never auto-retry. Private errors retain
  HTTP status/Retry-After without echoing keys, content or recipient data. No
  public route calls it yet. There is no broadcast-send method or account-wide
  quota reservation implementation; draft creation is not activation.

### Consent, audience and account-notice integration — local follow-up

`20261108000000_add_learning_email_consent_and_budget_controls.sql` is a second
**unapplied** local migration, following the draft migration above. It adds:

- Transactional consent changes: preference, versioned audit event and desired
  provider-sync record commit together. Repeated same-state requests do not
  duplicate events. Explicit re-consent after an opt-out creates a new version;
  it never asserts or resets Resend's global subscription status.
- Both the authenticated preference endpoint and token-unsubscribe endpoint use
  service-only RPCs. The authenticated route binds the current confirmed user,
  not a supplied user ID. Missing migration/failure has no direct-write fallback.
  Email-link GET does not mutate; POST accepts bounded 1 KiB URL-encoded forms,
  rejects duplicate tokens, and returns private/no-referrer responses.
- A completion for an old consent version cannot acknowledge a newer opt-out.
  Marketing attempt claims reject pending synchronization. The sync-completion
  RPC is service-only and must only be called after verified provider read-back.
  An internal, disabled-by-default outbox processor now performs membership-only
  sync through an injected provider client; no scheduler/HTTP activation or
  provider webhook reconciliation is enabled.
- A pure, server-only audience planner allows only the reserved Learning segment.
  It checks complete catalogs, exact email membership (not counts), explicit
  confirmed Learning consent, global suppressions and the shared 1,000-contact
  ceiling. It proposes Learning-segment-only adds/removals and separately lists
  missing contacts requiring import approval. It never deletes shared contacts
  or resets global unsubscribe state. No proposed provider operation was applied.
- An atomic **Email Center-only** allowance ledger starts at zero, with maximum
  configurable limits of 10/day and 100/month, counted by UTC windows. It requires
  a confirmed designated operator and an explicitly approved allocation valid
  for at most 15 minutes. Reservations persist through failures/uncertainty;
  they are not refunded into an automatic retry. These ceilings are code bounds,
  **not an owner-approved allocation and not a guarantee of remaining shared
  quota**. Careers, Auth, course and other application senders do not use it.
- Each account-notice attempt also fetches Resend `/usage` using the **same key**
  as the transactional transport. Unknown/malformed/unavailable usage, an
  unexpected plan allowance, or a snapshot older than five seconds blocks it.
  The initial conservative guard leaves more than 25 daily and 250 monthly
  transactional slots before the one message. This is a per-attempt preflight,
  not a reservation against simultaneous Careers/Auth activity. The provider
  owns its reported daily window; our additional UTC-day ledger does not imply
  that Resend resets at UTC midnight. Account alignment/permissions must still
  be verified before activation. Only fake HTTP responses were used here.
- The internal account-notice worker loads saved content/targets from Learning,
  validates review revision, claims once, reserves allowance, invokes the Resend
  adapter and checks the durable checkpoint. Stale review, unknown targets,
  closed/expired allowance, uncertainty or audit-write failure cannot silently
  turn into another send. It is not connected to an enabled HTTP send action.

Tests execute both actual migrations in isolated PGlite, the internal worker,
the real email renderer/adapter with fake fetch, and actual preference/
unsubscribe handlers with fake clients. They cover audit rollback, consent
version races, pending sync, wrong same-count audiences, global suppression,
free contact ceiling, default/expired/daily/monthly allowance, duplicate calls,
provider uncertainty and persistence failure. No live provider/database call is
made. This is not multi-session PostgreSQL concurrency certification.

The consent worker uses a service-only, **non-expiring** segment lease. Only one
sync/broadcast workflow may own it at a time. It reads existing contacts and
Learning membership, changes only that membership, verifies the result, and
acknowledges only the current consent version. Global unsubscribes stay intact;
a newly arrived local opt-out compensates a stale membership add. A confirmed
email change can remove the previous recorded membership before linking the
new address. Unknown contacts remain `awaiting_contact_import` without creating
or updating global contacts. An uncertain write or failed checkpoint retains
the lease and requires reconciliation; no blind retry or timeout takeover.
Provider calls are serialized and paced at 250 ms by default; shared-team 429s
still fail closed instead of retrying. Tests bypass only this delay, not checks.

No consent worker is invoked by a public route or scheduled task. The broadcast
sender must use the same ownership protocol and handle queued delivery before
releasing it. Provider-global unsubscribe webhooks, automatic discovery of
identity/deletion changes, safe contact import and operator recovery UI remain
required before calling the end-to-end marketing workflow complete.

## Shared provider account — read-only check on 22 October 2026

The owner confirmed Learning and Careers use the same Resend team. The signed-in
`growvelt` dashboard showed:

- `growvelt.com` and `updates.growvelt.com`: Verified. This verifies sending
  domains, not the existence/reply routing of each mailbox.
- Transactional Free: 9/100 daily and 138/3,000 monthly at inspection time.
- Marketing Free: 592/1,000 contacts, 568 subscribers and 24 unsubscribers.
- All 3/3 segment slots occupied: Growvelt All Users (592 contacts), Growvelt
  Job Seekers (586), and General (0). These counts are not Learning consent.
- No topics configured. Pay-as-you-go controls were off/disabled; unchanged.

No contacts, keys, subscriptions, segments, topics, billing or sender settings
were changed and no email/provider draft was created. The usage snapshot is not
a quota reservation and must be rechecked before an approved controlled test.
Learning must not reuse Careers' populated segments. A read-only coordination
request was sent to the Careers chat to check whether the empty General segment
is referenced in code/hosted settings before proposing any reuse to the owner.
Do not rename/delete/repopulate it on the strength of an empty count alone.

### Conditional segment approval — 22 October 2026

The owner approved repurposing General exclusively for Learning **only once
Careers' production mappings were confirmed/re-established**. Initially, Careers'
follow-up found no exact ID reference in its repository/workflows and neither
local segment variable matched it. Both production segment variables exist in
Vercel but are write-only secrets, so their values could not be compared. No
segment rename, contact import, audience synchronization or deployment is
authorized by an assumption that empty means unused.

Learning also checked the shared Resend Automations page with All statuses:
it shows **No automations yet**. No automation changes were made. This resolves
the provider-automation check but not the write-only hosted-variable question.

The owner subsequently reported saving both exact production mappings and
redeploying Careers' known-good `711fc21` source as Ready/Latest/Production:

- `RESEND_MARKETING_SEGMENT_ID`: Growvelt All Users,
  `a8776ea3-0012-4c55-a887-1c0153466738`.
- `RESEND_JOB_SEEKERS_SEGMENT_ID`: Growvelt Job Seekers,
  `da73a70c-21e6-47fa-885e-a98da9691f7c`.

Evidence basis: the owner's report of the entered values, save confirmations
and redeployment of the existing source with latest project settings. Learning
did not independently read back write-only secrets or change Careers. Reported
deployment: `EU4hD1CeiK3mZVTQZ29aN1kmgNMG`.

Learning then used the existing approval to rename **only** General to
**Growvelt Learning** in the shared Growvelt Resend team. The segment retains ID
`f0815500-6d8a-4662-857f-eaec9d4e0971`, with 0 contacts and 0 unsubscribers.
Both Careers segment names/IDs/counts remained unchanged (All Users 592,
Job Seekers 586). The UI still shows three segments. No segment was created or
deleted, and no contact, subscription, automation, credential or billing setting
was changed. No provider broadcast draft or email was created/sent.

`RESEND_LEARNING_SEGMENT_ID` is recorded in `.env.example` as a Learning-only
configuration reference. No Learning hosted variable was saved and no sending
gate was enabled. This is an audience reservation, not completed delivery
functionality. A screenshot of the saved segment list is available at
`C:/Users/HP/.codex/visualizations/2026/09/19/01a0ba2a-e84d-79d3-8977-06bd77809f58/learning-resend-segment-2026-10-22.png`.

Rollback for this label-only change: rename that same still-empty ID back to
General. Do not delete/recreate it, remove contacts, or change Careers segments.
After contact synchronization exists, label rollback is not a consent rollback.

Local `.env.local` has a misspelled `RESENDE_API_KY` entry; the application expects
`RESEND_API_KEY`. No value was displayed, renamed or sent to Resend. Hosted
Vercel environment names/values have not been verified in this checkpoint; a
local typo is not evidence that production email configuration is incorrect.

## Deliberately not activated / still to implement

The HTTP send action always fails closed. There is no automatic fallback to
the previous per-recipient marketing `/emails` loop. Broadcast and transactional
mode currently describe the saved intent; no Resend broadcast/contact/segment
is created. Notification-bell and device-push delivery remain disabled, rather
than exposing a control that falsely claims delivery.

Before real sending can be completed/activated:

1. Verify the permitted sender addresses in Learning. The owner confirmed
   `partnership@growvelt.com` for Growvelt Partnerships; this is an approved
   address choice, not proof of provider verification. Planned server-side variable names are
   `LEARNING_FROM_EMAIL`, `SUPPORT_FROM_EMAIL`, `ADMIN_FROM_EMAIL`,
   `PARTNERSHIPS_FROM_EMAIL`, and `NOREPLY_FROM_EMAIL`. Merely setting one does
   not prove domain verification or mailbox routing. There is no Careers alias
   fallback and operator Gmail is not a proposed From address.
2. Verify Learning's existing provider configuration without copying Careers
   credentials. The provider team is confirmed shared; separate keys and
   segments do not isolate quota/global unsubscribe. Establish an approved
   Learning transactional allocation with headroom for sign-in/course emails
   and account-wide usage coordination. The worker's budget-reservation
   local ledger is not an implemented account-wide quota system.
3. Design/verify Learning provider contacts/topics/targeting and consent
   synchronization. Respect existing global suppressions; never automatically
   reset unsubscribed contacts. A Learning-only local count is not proof of
   provider broadcast membership. Do not import contacts without approval.
4. Finish HTTP activation/review integration for account notices and the future
   broadcast worker. Persist provider draft/operation IDs, verify exact
   recipient targeting before broadcast send, and add provider reconciliation
   for uncertain outcomes. Never blindly retry a stranded claim or assume a
   provider acceptance is delivery. A single reserved Learning segment needs an
   exclusive campaign workflow: serialize membership changes, recheck consent
   and the complete provider recipient set, and retain ownership through queued
   sending until verified completion. Do not repoint a queued campaign's
   segment at another role/audience. No automatic retry is supplied here.
5. Connect optional bell delivery separately using Learning-owned recipient
   scoping and deduplication; keep push independent until its own foundation is
   ready. External partners need their own explicit-consent contact design.
6. After local integration tests, seek approval for both hosted migrations
   and provider settings, deploy the isolated changes, then arrange a separate
   controlled opt-in send. No production email is implied by these local tests.

Provider references: [broadcasts](https://resend.com/docs/dashboard/broadcasts/introduction),
[account quotas](https://resend.com/docs/knowledge-base/account-quotas-and-limits),
[usage API](https://resend.com/docs/api-reference/usage/retrieve-usage),
[Learning-segment membership operation](https://resend.com/docs/api-reference/contacts/add-contact-to-segment),
[transactional versus broadcast allowance](https://resend.com/pricing).
Review current account usage/plan before activation; no paid upgrade is assumed.

## Tests and local browser harness

- `npm run test:email-center:upgrade`: actual validation, operator helper,
  renderer and worker with local provider/store fakes; unsafe formatting/URLs,
  classification rules, private operator model, closed gate, duplicate requests,
  budget denial, uncertain responses and checkpoint failure.
- `npm run test:email-center:upgrade-db`: actual migration in isolated PGlite;
  preserved users, both operators, role grants/RLS, save retries/revisions,
  audience/consent rules, snapshots/dedup, edit invalidation, unique claims,
  checkpoint idempotency and locked content. This is not a multi-session hosted
  concurrency or complete provider-delivery certification test.
- `npm run test:email-center:resend`: fake fetch only; disabled provider gate,
  verified-domain/approved partnership sender, strict mode separation,
  transactional idempotency, draft-only broadcasts, private errors, malformed
  acceptance, network failure and rate-limit/no-retry behavior. No real API call.
- `npm run test:email-center:controls`: isolated SQL + internal worker + actual
  adapter with fake HTTP; consent/audit/outbox atomicity and version checks,
  private grants, audience isolation/suppression, within-plan contact count,
  default/expired/day/month budget caps, duplicate/uncertain/stranded attempts.
  Includes same-key fresh usage preflight, complete sync/version processing,
  global suppression, compensating stale-add removal, confirmed-email relink,
  missing-contact no-import and retained lease after an uncertain remote write.
- `npm run test:email-center:consent-api`: actual routes with fake clients;
  confirmed-session ownership, no fallback, GET safety, bounded form and failures.
- Extended `test:phase6:api`: actual Email Center handlers, both confirmed
  operators plus admin role, other/unconfirmed/non-admin denial, bounded JSON,
  local preview, save/review and explicit rejection of all actual send actions.
- Production build/TypeScript and focused lint; existing login email, recovery,
  communications/RLS, Auth/domain and request-boundary regressions.
- `node scripts/preview-email-center-local.cjs`: loopback-only standalone QA
  harness on `127.0.0.1:4317`, actual React composer/API/migration, fake session
  and in-memory Learning accounts. No `.env` is loaded. Runtime authorization
  uses the fixture session only in this script, never in a Next route. Compiled
  browser assets are temporary; stopping the harness discards its fake data.
  No hosted endpoint or provider transport is reachable from its API.

Browser checks passed saving, sandboxed branded preview, actual one-recipient
consent review, loading the saved draft after browser reload, and edit-induced
review invalidation. Requested 320/390 px viewports showed no horizontal page
overflow (305/375 px content widths with browser scrollbar). This is fixture
browser coverage, not production sign-in/provider testing or accessibility
certification. The harness is not a publicly hosted admin bypass.

## Release and rollback

Keep this work local until the missing transport/consent/budget integration is
completed and approved. Do not deploy a schema-dependent page ahead of its
migrations. After approval, capture exact current/prior Ready Vercel deployment
IDs, apply only these three migrations to verified Learning Supabase, validate private
grants/operator/snapshot behavior, and deploy the isolated release with sending
still closed. Rollback must keep email/sync activation disabled and preserve new
audit/draft tables. Do not blindly restore a legacy Email Center route that can
send per-recipient marketing without these guards. If falling back to older
preference code, reconcile all consent/provider state before any later restart;
older direct writes do not maintain the new outbox. No hosted rollback was run.

Phase Six remains open. This checkpoint does not enable Live checkout,
subscription payments, instructor payouts, production marketing or Careers work.
