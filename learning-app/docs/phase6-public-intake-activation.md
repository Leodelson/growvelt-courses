# Public intake quotas — prepared, not active

21 October 2026. Learning only; no hosted migration, Auth/payment setting,
Careers change, or paid service is authorized by preparing these files.

## Scope and proposed limits

| Intake | Accepted globally/hour | Accepted globally/UTC day | Accepted per email/hour | Accepted per email/UTC day |
| --- | ---: | ---: | ---: | ---: |
| Newsletter | 200 | 1,000 | 1 | 1 |
| Contact and partnership combined | 50 | 200 | 3 | 5 |

These are conservative starter budgets for owner review, not observed traffic.
Windows are fixed epoch-aligned hours/UTC days, not rolling windows. Boundary
bursts are possible. Newsletter uniqueness still applies: duplicate sign-ups
do not become new records or consume accepted-volume counters.

The migration installs BEFORE INSERT triggers on the two existing tables.
This covers existing newsletter INSERTs (including direct Supabase clients)
and inquiries submitted through the existing SECURITY DEFINER RPC. It does
not revoke or replace these working entry points. All new inserts, including
trusted imports, receive server timestamps and normalized email addresses.
Existing records, consent state and timestamps are not rewritten.

Four conditional counter UPSERTs enforce global and email hour/day limits in
the same transaction as each record. Rejection rolls back every counter
increment. The approach uses PostgreSQL's
[atomic ON CONFLICT update behavior](https://www.postgresql.org/docs/17/sql-insert.html).
No untrusted IP/header identity, in-memory counter, or new external service is
used. A `PT429` database error maps to HTTP 429 through
[PostgREST's custom status mechanism](https://docs.postgrest.org/en/v13/references/errors.html).
App routes map that code to a friendly message, no-store and Retry-After 3600.
Retry-After is a minimum retry delay, not a promise that a daily budget resets
within an hour. Forms do not automatically retry POSTs.

App newsletter responses for new/existing addresses have the same 202 status
and generic message. This is app-response privacy only: the retained direct
Supabase INSERT/unique-error behavior can still disclose duplicates. A fully
opaque public intake contract requires a separate endpoint/permission design.

## Data, limits, and residual risks

- Quota tables use RLS and no anon/authenticated/PUBLIC grants. Only the table
  owner and service role can inspect/manage state. Helper/trigger functions
  are not granted for direct execution by browser or service roles.
- Email keys use core PostgreSQL SHA-256, not raw email addresses; they are
  pseudonymous, not anonymous (email guesses can be hashed). No IP addresses,
  user agents or message bodies are copied into counters.
- Accepted writes clear buckets whose start is older than two days. This is
  on-write housekeeping, not an idle-time deletion guarantee; no cron is added.
  If rolled back or idle, protected counters remain until reviewed cleanup.
- Limits bound accepted records, not all attempts, provider calls, CPU, DB
  connections, or network traffic. Rejected/duplicate attempts still cost a
  database request. This is not DDoS protection or CAPTCHA on public forms.
- A rotating-email flood can exhaust the global budget and temporarily deny
  genuine submissions. Review traffic and the direct support alternatives
  before enabling; tune through owner/service-role SQL only. Do not raise caps
  automatically or claim that quotas identify individual people.
- Existing support conversations, login activity, Auth, course enrollment,
  payments, marketing opt-in and outbound-email delivery are unaffected.

## Verification and activation order

1. Run `npm run test:phase6:intake-db` (isolated PGlite). This covers real SQL
   migration/reapply/rollback, original grants/records, private counter state,
   direct inserts, the existing RPC, normalized email/timestamps, all quota
   slots, multirow atomic rejection, cleanup, and read-only assertions.
2. Run `npm run test:phase6:api` for compatible app behavior before and after
   quota errors, unchanged successful inquiry handling, non-enumerating app
   newsletter responses, and existing security boundaries.
3. Required before hosted activation: with Docker Desktop's existing local
   engine and `supabase_db_growvelt-learning-phase0c-local` running on 55432,
   run `npm run test:phase6:intake-concurrency`. It targets only the local
   Docker pipe/socket, creates a fresh random test database, observes real
   PostgreSQL lock waits for four competing-session caps, then removes only
   that disposable database. It never changes the existing local database.
   Result on 21 October: PASS after the owner started Docker. All four real
   multi-session races observed lock waits, accepted one submission at the cap,
   and rolled back every rejected counter change. The fresh disposable database
   was removed. PGlite's single-connection results alone are not concurrency
   certification; this separate PostgreSQL test supplies that evidence.
4. Deploy the compatible app code first. Existing SQL still works; quotas
   remain inactive until the migration is explicitly approved and applied.
5. Owner approves the above budgets after the concurrency result and reviews
   any other pending migrations. Apply only
   `20261106000000_add_public_intake_quotas.sql` in the Learning project
   `qtcpjcaoptdunuefwvgc`; do not blindly apply every pending migration.
6. Run `supabase/tests/phase6_public_intake_assertions.sql` read-only and verify
   both triggers, private-state grants/RLS, original entry permissions, and
   intended limits. Do not use real email submissions to force quota failures.
7. Review error/traffic levels through existing free logs and aggregate SQL:

```sql
select kind, window_seconds, window_start, accepted_count
from public.learning_public_intake_counters
where subject_key = 'all'
order by window_start desc, kind, window_seconds;
```

## Rollback

For unexpected legitimate rejection, apply only the operator-reviewed file
`supabase/rollbacks/20261106000000_public_intake_quotas.sql`. It removes the two
new triggers inside a transaction, restoring the previous intake behavior.
It does not remove customer records, counter state, configuration, or original
grants. The compatible app code can remain deployed. Disabling triggers also
disables counter cleanup. Reapplying the migration restores enforcement and
preserves operator settings/counters; it is not a budget reset.

Verification complete for this slice: isolated SQL/reapply/rollback, real
multi-session PostgreSQL races, API fixtures, focused lint, production build,
Auth/domain regressions and local production HTTP checks all passed.
Status: local preparation only. Hosted quota activation remains unapproved.
