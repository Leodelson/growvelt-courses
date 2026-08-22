# Growvelt Learning Phase 0C readiness decisions

## Staging gate

No separate Supabase staging project is currently configured in this
repository. Production project `qtcpjcaoptdunuefwvgc` is explicitly rejected by
the Phase 0C test runner.

To establish staging safely:

1. Create a separate Supabase project in the intended Growvelt organization.
2. Record its non-secret project ref as `SUPABASE_TEST_PROJECT_REF` locally/CI.
3. Set `SUPABASE_ACCESS_TOKEN` only in the local shell or CI secret store.
4. Apply the tracked migrations to staging, then seed disposable identities:
   two learners, one approved instructor, one enrollment and one paid published
   test course. Never copy production personal data.
5. Set `PHASE0C_ALLOW_REMOTE_TESTS=true` only after confirming the ref.
6. Run `npm run test:security:staging`.

The runner fails closed when the target is missing, when explicit approval is
missing, or when the production ref is supplied.

## No-cost local validation

When a separate hosted staging project is unavailable, Phase 0C uses an
isolated database-only Supabase project under the operating-system temp
directory. `npm run prepare:security:local` generates a disposable baseline
migration from `supabase/schemas` using pg-delta, then layers only the pending
Phase 0B privilege hardening and pending Phase 0C audit migration over it. The generated baseline is never placed in
the repository migration chain and must never be deployed remotely.

Because pg-delta does not preserve column privileges reliably, the preparation
script also extracts the exact column-level grants from the captured table
schemas into a temp-only reconciliation migration. It does not add broad
privileges and Phase 0B hardening is applied immediately afterward.

The local project uses ports `55430` and `55432`, contains no production data,
and has a distinct project id. Commands against it must always pass its
temporary `--workdir`; linked commands and production credentials are neither
needed nor permitted.

Safe Windows workflow:

1. Run `npm run prepare:security:local` while the isolated project is stopped.
2. Run `supabase db start --workdir "$env:TEMP\growvelt-learning-phase0c-local"`.
3. Run `npm run test:security:local`.
4. Run `supabase stop --no-backup --workdir "$env:TEMP\growvelt-learning-phase0c-local"` when finished.

The preparation command fails closed if the isolated database container already
exists, preventing removal of an active local work directory.

## Certificate and account-deletion retention

Current approved behavior remains unchanged: deleting an Auth user cascades
through the profile and currently removes that learner's certificate rows.
Phase 0C does not silently change this user-visible/legal behavior.

Before financial work, Growvelt must choose one policy:

- full erasure, including public certificate verification; or
- retained achievement records with documented lawful basis, a detached or
  pseudonymized learner reference, defined retention, and an appeal/revocation
  process.

Until that decision is approved, existing cascade behavior is preserved. Audit
events intentionally have no foreign key to profiles, contain no email/name,
and can record that deletion was requested without preventing account removal.

## Legacy objects

`course_contacts`, `course_leads`, `partner_requests`, and the four unused
learner read functions remain deprecated. `course_registrations` remains a
remove-later candidate and must never become the marketplace payment ledger.
No legacy object is deleted in Phase 0C.

## Service-role controls

Service-role use is limited to:

- account deletion after server-side `auth.getUser()`;
- welcome-email delivery markers after authenticated eligibility checks.

Both POST entry points now reject cross-origin browser requests. Service keys
remain server-only, are never returned to the browser, and are not logged.
Account deletion writes a minimal audit event containing only the user UUID,
action, entity type and non-personal source metadata.

## Financial-readiness gate

Phase 1 must not start until all of the following are true:

- a separate staging project exists and the repeatable authorization suite
  passes there;
- append-only audit events are deployed and verified;
- certificate/account-deletion retention is approved;
- legacy payment-shaped objects are formally excluded;
- payment initialization, verification and webhook designs use server-side
  authoritative prices and idempotency;
- a double-entry or equivalent immutable financial ledger is designed;
- refund, chargeback, currency and reconciliation rules are approved;
- provider earnings and payouts remain separate from learner payment records;
- secret rotation, webhook signature verification and incident procedures are
  documented.
