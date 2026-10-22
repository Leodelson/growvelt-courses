# Learning communications — local security and recovery checkpoint

22 October 2026. Learning only. No provider email, hosted write, account sign-in,
payment, Auth setting or Careers change was made for this checkpoint.

## Request boundaries verified

Existing same-origin and verified-session checks remain ahead of body parsing.
Email Center additionally checks the database-backed admin role before parsing
or creating a privileged client. Reject invalid JSON/non-object bodies with
400, unsupported content types with 415, and oversized actual UTF-8 bytes with
413, irrespective of forged/missing Content-Length. Parsing error responses
are private/no-store and do not echo input.

| Endpoint | Method | JSON limit |
| --- | --- | --- |
| `/api/learning/support` | POST | 32 KiB |
| `/api/learning/support/[id]` | POST | 32 KiB |
| `/api/learning/admin/emails` | POST | 32 KiB |
| `/api/learning/notifications` | PATCH | 1 KiB |
| `/api/learning/email/preferences` | POST | 1 KiB |

Existing field limits, direct database permissions and RPC authorization are
unchanged. The 32 KiB envelope permits maximum-length support fields even when
every letter is represented as a six-byte JSON Unicode escape. Small preference
and notification bodies allow exactly 1 KiB, but reject one extra byte.
These are memory/body limits, not new distributed rate limits. Support's
database limits and public-role access require their own concurrency review;
the separate newsletter/inquiry quota activation does not cover support.

## Login-alert failure checks

`test:phase6:email-recovery` executes the real scheduling/delivery module with
fake `after` and fetch implementations. Provider acceptance/rejection, simulated
timeout, scheduling error, missing key and missing recipient were exercised.
Delivery starts only in the scheduled task, is scoped to the authenticated email,
and uses a user/sign-in-specific idempotency key and existing request timeout.
Failures do not escape the task/scheduler or block authentication. Logs contain
generic events/statuses, not fixture email addresses, IP, location, HTML, keys
or provider exception text. Existing email-template/escaping tests remain
separate. Simulated timeout coverage is not a live provider connectivity test.

Provider acceptance is not inbox delivery. There is no durable retry queue for
login alerts: an email can be missed if scheduling/provider delivery fails.
Do not replay a sign-in, manufacture login timestamps, or delete activity rows
to force another email. The alert email is secondary to authentication and the
recorded activity; notification persistence can fail separately and needs its
own failure/repair review before declaring the entire pipeline hardened.

## Safe incident handling using existing free dashboards

1. Identify the failing route and deployment SHA/time in Vercel runtime logs.
   Use generic error/status messages; do not copy Auth query strings, bearer
   tokens, provider response bodies or recipient lists into chats/logs.
2. For login email failures, inspect the existing provider dashboard for the
   appropriate time/product category. An accepted request is not proof of
   delivery. Avoid repeat sign-ins as an automated health check.
3. For Email Center, pause manual batch sends if outcomes are uncertain.
   Inspect campaign/delivery states with authorized admin access and compare
   provider-message evidence before any recovery action. Existing unique
   campaign/user claims exclude claimed, accepted, failed and skipped rows
   from later recipient selection. Clicking Send again does not retry failed
   or stranded claimed recipients. Never delete/reset those claims or opt
   users in to manufacture retries; doing so can duplicate mail or violate
   consent. An explicit reconciliation/retry design and failure-injection
   tests are still required. Current batch writes do not consistently check
   persistence errors, so its UI counters/status are not authoritative evidence.
4. For support reply errors, check the response class: 401 requires sign-in,
   403 is permission denial, 429 is the existing database throttle, and 503
   is an unavailable operation. Do not bypass RLS or retry in a tight loop.
5. Escalate persistent failures to the owner with product, route, time, status
   and commit only. No automated marketing email, paid monitor or new cron
   was enabled by this review.

## Application rollback (no database rollback needed for these body limits)

Before release acceptance, record the exact Ready production deployment URL/ID
and commit for this release and the prior working deployment in Vercel. A Git
push alone does not establish Ready production status. If this release causes
a regression, the owner can promote the verified prior deployment through the
existing Vercel rollback flow, or authorize a normal revert-and-push of this
isolated release commit. Do not reset unrelated work or force-push.

These changes introduce no schema migration. Preserve the active public intake
quota migration, all records, domain assignments, hosted Auth settings, email
templates and disabled Live checkout. Re-test same-origin valid forms and
unauthorized/cross-origin denial after rollback. The last recorded Ready
production checkpoint in the intake runbook is commit `146282a`, deployment
`4k715Zdw7ZXDBPSDy28q6hPW9UxN`; confirm current deployment state rather than
assuming this historical checkpoint is the latest or best rollback target.

## Verification and remaining scope

Actual-handler fixtures cover body/type/shape rejection before mutation or
privileged access, exact limits, maximum valid support/draft fields, forged
sender/owner fields, role denial and support permission/throttle/unavailable
responses. Isolated PGlite tests separately enforce support RLS, other-user
denial, admin-only resolution, replies, notifications and state transitions.

This checkpoint does not certify broadcast delivery/retry accounting, support
quota concurrency, all API handlers, production mail, a complete secret scan,
accessibility or Live payment readiness. Keep Phase Six open.
