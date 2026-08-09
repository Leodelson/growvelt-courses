# Growvelt Learning Phase 1C-B: Instructor review operations

## Scope

This runbook applies `202608090003_instructor_application_review_audit.sql`. It adds `reviewed_by` and a bounded `review_note` to `public.instructor_profiles`, replaces the two-argument review RPC with the protected three-argument version, and replaces broad browser table reads with applicant-safe column reads.

The metadata records only the latest/current decision. It is **not** a complete historical application-review audit log.

`reviewed_by` and `review_note` are internal. Applicants retain access only to safe columns on their own application row. The Admin queue/detail UI obtains internal review data through two read-only, Admin-authorized `SECURITY DEFINER` functions; it does not receive a broad browser table `SELECT` grant.

## Preconditions

- The authorization-hardening migration and profile-creation migration are already applied and verified.
- A legitimate Learning Admin has been deliberately bootstrapped in `public.account_capabilities` using the controlled owner/service-role procedure.
- Inspect the migration guard output first. Do not amend its assumptions to force an unknown partial schema through.
- Confirm no currently deployed client still calls the legacy two-argument review RPC. The old untracked prototype is not an approved production caller.

## Execution order

1. Schedule a short operational window; the migration is atomic, and the new application expects the three-argument RPC.
2. Apply `supabase/migrations/202608090003_instructor_application_review_audit.sql` once through the approved Supabase migration workflow.
3. Confirm the transaction succeeded before reviewing applications in the UI.
4. Deploy the reviewed Learning application source after the migration is verified.
5. Use `/admin/instructors` only from an authenticated account with an active `admin` capability.

## Verification queries

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'instructor_profiles'
  and column_name in ('reviewed_by', 'review_note', 'approval_status', 'reviewed_at')
order by column_name;

select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.instructor_profiles'::regclass
  and conname = 'instructor_profiles_review_note_length_check';

select routine_name, specific_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'review_instructor_application';

select grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'review_instructor_application'
order by grantee, privilege_type;

select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public'
  and table_name = 'instructor_profiles'
  and grantee = 'authenticated'
order by column_name, privilege_type;
```

## Functional checks

- Unauthenticated visitors are redirected away from `/admin/instructors`.
- Authenticated non-Admins are redirected to `/dashboard` before application data is queried.
- An active Admin sees pending applications newest first and can open one detail page.
- Approval changes the row to `approved`, records `reviewed_at`, `reviewed_by`, and optional note, and activates the `instructor` capability in the same RPC transaction.
- Rejection changes the row to `rejected`, records review metadata, and leaves no active `instructor` capability.
- A second review request for a finalized application fails.
- `public.is_approved_growvelt_instructor()` returns true only after an approved row and active Instructor capability both exist.
- Direct browser attempts to update review fields or `account_capabilities` fail.
- An applicant can read their own safe application fields, including `approval_status` and `reviewed_at`, but cannot select `reviewed_by` or `review_note`.
- An Admin can read review metadata only through `list_pending_instructor_applications()` and `get_instructor_application_for_review(uuid)`; both reject non-Admins internally.

## Corrective guidance

Do not restore direct browser UPDATE access to `approval_status`, `reviewed_at`, `reviewed_by`, `review_note`, or `account_capabilities` if a legacy page fails. Correct the caller to use the narrow review RPC.

If an application was reviewed in error, do not alter it from the browser. This phase intentionally has no re-review workflow or historical audit log. Use a controlled owner/service-role operation, record the incident operationally, and create a forward-only remediation migration or controlled procedure before changing final state.

## Not included

This phase does not create notifications, email, reapplication, course authoring/publishing, payments, storage, video, certificates, ratings, earnings, or a complete review-event audit trail.
