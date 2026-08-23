# Phase 0D: Account deletion and certificate retention

Phase 0D introduces controlled self-service account deletion without changing existing account, course, progress, or certificate data until a user explicitly requests deletion.

## Learners

An eligible learner must choose one certificate outcome:

- **Keep certificates verifiable:** the certificate snapshot remains publicly verifiable, while its account identifier is removed.
- **Remove public verification:** the learner name is removed, the certificate is revoked, and the record remains only as an anonymized integrity record.

If no valid deletion request exists, database deletion defaults to the privacy-protective remove-public-verification outcome.

## Managed offboarding

Self-service deletion is blocked when the account:

- has an active Learning administrator capability; or
- owns Learning courses or course-rights declarations.

These accounts require a future, explicitly approved managed-offboarding process. Phase 0D does not transfer or delete instructor content and does not revoke administrator authority automatically.

## Database safeguards

- Certificate snapshots are detached from deleted profiles with a recorded retention state and deletion timestamp.
- Enrollment deletion removes dependent quiz attempts first so account deletion cannot fail on the existing restrictive quiz-attempt relationship.
- The deletion choice is accepted only through an authenticated, database-authorized RPC.
- The production API still performs the final Auth deletion with a server-only Supabase secret after same-origin and authenticated-user checks.

## Deployment safety

`20260823180000_account_deletion_certificate_retention.sql` is a forward-only migration. It does not delete or rewrite existing production rows when deployed. It must be validated locally before any separately approved production deployment. The Phase 0A baseline must never be reapplied.
