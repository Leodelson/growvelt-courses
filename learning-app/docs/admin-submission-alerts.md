# Administrator submission alerts

Operational email, not marketing. Every newly submitted partnership/contact request, instructor application, provider-verification submission, course review submission and customer support message creates two private delivery records. Recipients are fixed to nduleonardc@gmail.com and admin@growvelt.com. Staff replies, ordinary profile edits, course drafts and newsletter signups do not notify administrators.

Only the form's explicitly selected review fields are rendered. Passwords, authentication tokens, bank details, honeypots, quiz answers and private uploaded files are excluded. The email uses the existing Growvelt template and a signed-in review link. No request is approved by receiving an email.

## Activation

1. Apply `20261110000000_add_admin_submission_alerts.sql` to the Learning project only. It creates four service-only RLS tables, three service-only worker functions and capture triggers on five existing submission tables. It does not backfill or email earlier submissions.
2. Release the application changes. Existing transactional and marketing/usage keys stay server-only and unchanged. `ADMIN_FROM_EMAIL` must be exactly `admin@growvelt.com`.
3. Set Production `LEARNING_ADMIN_ALERTS_ENABLED=enabled` and `LEARNING_ADMIN_ALERT_DAILY_LIMIT=20`, as approved by the owner. Redeploy the known tested source. Missing or invalid settings keep sending disabled.
4. Submit a fresh controlled form and check both inboxes, provider acceptance and the private Submission alerts page. Local tests do not prove live delivery.

## Safeguards and recovery

- The form and alert references are committed together; no network request occurs in a database transaction. Post-response scheduling failure never changes the successful form response.
- A service-only global lease prevents concurrent drains. A delivery is claimed and its daily reservation saved before the provider request. The stable provider idempotency key is unique to that delivery.
- The approved local ceiling is **20 email attempts per UTC day**, normally 10 submissions. Failed or uncertain attempts retain their reservation. This is not an additional Resend allowance.
- Before each attempt the worker verifies shared free-plan usage and leaves at least 25 daily and 250 monthly messages for other account/security traffic. Careers can use that same allowance concurrently; this is a conservative check, not a cross-product atomic reservation. If usage cannot be verified, sending stops and unclaimed records remain pending.
- A short batch runs after successful form routes. A daily cron at 04:10 UTC and the admin-only **Send pending alerts** button can drain remaining pending work. Quota exhaustion leaves overflow pending. Scheduled runs are not a guarantee of immediate delivery.
- `pending`: not attempted. `dispatching`: claim saved; outcome needs checking if stale. `accepted`: provider accepted, not proof of delivery. `uncertain`: provider response was lost or failed; inspect provider records. `failed`: source removed or superseded. Accepted, dispatching, uncertain and failed records are never automatically resent.
- Both administrators must be confirmed users and pass the existing database admin check to view the private inbox. Browser clients cannot read the outbox tables or call worker functions.
- Old submissions are deliberately not backfilled. Existing submitted forms remain in their normal review workspaces.

## Rollback

Disable `LEARNING_ADMIN_ALERTS_ENABLED` and redeploy before rolling application code back. Keep the additive schema and queued audit records. Do not delete delivery records or reset reservations to retry an unknown outcome. No destructive schema rollback is necessary. If a capture trigger itself causes submission failures, an operator may transactionally disable only the five `admin_submission_alert` triggers after investigating; retain all source forms and outbox records.

## Verification

`node scripts/test-admin-submission-alerts.mjs` executes the actual migration in local PostgreSQL-compatible PGlite and the real worker with injected, network-free provider responses. It covers all five sources, both recipients, no historical backfill, private grants/RLS, source-version checks, lease isolation, shared quota and daily limits, escaped content, idempotency and no resend after uncertain/lost checkpoints. Existing API boundary and email compatibility regression suites remain required.
