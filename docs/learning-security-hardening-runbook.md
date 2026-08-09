# Growvelt Learning security-hardening runbook

## Purpose

This runbook applies the forward-only Learning authorization hardening migration. It corrects four confirmed issues: mutable browser-controlled `account_type`, self-approval of instructor applications, direct paid-course enrollment, and direct review publishing.

It does not connect `learning-app`, create payments, or change the course data model.

## Prerequisites

- Confirm the production project is the Growvelt Courses/Learning Supabase project.
- Take a read-only export of current policies, grants, functions, and the affected tables.
- Before the migration, identify and manually verify the legitimate existing Admin auth UUID through a trusted operator workflow. Keep that UUID ready, but do not place it in the migration.
- Deploy the legacy compatibility patch in this repository before, or in the same maintenance window as, the SQL migration. The old portal must not retain direct role, review, approval, or enrollment writes.
- Schedule a short maintenance window for legacy instructor application and enrollment actions.

## Execution order

1. Before the maintenance window, manually verify the legitimate existing Admin auth UUID and keep it ready in the operator runbook.
2. Deploy the compatible legacy static files only if that prototype is intentionally being deployed.
3. In Supabase SQL Editor or the approved migration workflow, review and execute `supabase/migrations/202608090001_learning_authorization_hardening.sql` once.
4. Immediately bootstrap that verified UUID with the active Admin capability using the owner/service-role SQL below.
5. Verify `is_growvelt_learning_admin()` in an authenticated Admin session, then validate Admin operations.
6. Run the remaining verification queries and functional tests.
7. Do not connect `learn.growvelt.com` to Supabase until this checklist is accepted.

The migration is intentionally guarded and atomic. It removes `profiles.account_type` as Admin authority immediately, so there is intentionally no recognized Learning Admin between migration completion and the bootstrap step. These steps belong in one short controlled maintenance window. If a guard fails, stop and compare the reported object with the live inventory. Do not delete objects or edit the migration in production to force it through.

For free courses, the approved MVP behavior is re-enrollment: a caller may reactivate only their own cancelled enrollment when the course remains published and free. This does not affect paid courses, which the RPC always rejects.

## First Admin bootstrap

Run this only as a database owner/service-role operational action after independently verifying the user UUID:

```sql
insert into public.account_capabilities (
  user_id, capability, status, granted_at, granted_by, revoked_at, revoked_by, reason
)
values (
  '<VERIFIED-USER-UUID>', 'admin', 'active', now(), null, null, null, null
)
on conflict (user_id, capability) do update
set status = 'active',
    granted_at = excluded.granted_at,
    granted_by = excluded.granted_by,
    revoked_at = null,
    revoked_by = null,
    reason = null;
```

Verify it:

```sql
select user_id, capability, status, granted_at, granted_by
from public.account_capabilities
where user_id = '<VERIFIED-USER-UUID>'
  and capability = 'admin';
```

Do not use `profiles.account_type` to bootstrap or verify Admin access.

## Production verification queries

```sql
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles', 'instructor_profiles', 'account_capabilities',
    'enrollments', 'course_reviews', 'learning_courses'
  )
order by tablename, policyname;

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'profiles', 'instructor_profiles', 'account_capabilities',
    'enrollments', 'course_reviews'
  )
order by table_name, grantee, privilege_type;

select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'has_growvelt_learning_capability',
    'is_growvelt_learning_admin',
    'is_approved_growvelt_instructor',
    'review_instructor_application',
    'enroll_in_free_learning_course'
  );
```

## Required functional tests

- A learner cannot insert/update `profiles.account_type` to `admin` or `instructor`.
- A learner cannot insert, update, suspend, revoke, or read another account's capability.
- A pending application can update only headline, bio, and expertise; it cannot set `approval_status` or `reviewed_at`.
- A verified Admin can approve/reject a pending application through `review_instructor_application`.
- Approval creates an active Instructor capability; rejection revokes any Instructor capability.
- `is_growvelt_learning_admin()` succeeds only for an active Admin capability.
- `is_approved_growvelt_instructor()` requires both active capability and approved profile state.
- Direct browser insert to `enrollments` fails.
- `enroll_in_free_learning_course` succeeds for a published `is_free = true` course, is idempotent for active/completed enrollments, safely reactivates only the caller's cancelled enrollment, and rejects paid/unpublished courses.
- Direct browser insert to `course_reviews` fails; existing published review reads still work.
- Approved Instructor course policies and Admin course policies continue to work without using `profiles.account_type`.

## Safe capability revocation

Use a trusted database-owner/service-role operation. Do not expose this to the browser:

```sql
update public.account_capabilities
set status = 'revoked',
    revoked_at = now(),
    revoked_by = '<VERIFIED-ACTOR-UUID>',
    reason = '<OPERATIONAL-REASON>'
where user_id = '<VERIFIED-TARGET-UUID>'
  and capability = 'instructor'
  and status <> 'revoked';
```

For an Admin capability, use a second verified Admin/operator and ensure at least one other active Admin remains before revocation.

## Emergency corrective strategy

If a legacy page fails, correct that page to use the approved narrow RPC or safe browser fields. Do **not** restore direct browser writes to `account_type`, `approval_status`, account capabilities, enrollments, or reviews.

The migration is forward-only: retain `profiles.account_type` as a legacy/display field, correct policies or grants with a subsequent migration, and use controlled capability state changes for recovery. Do not drop Learning data, existing constraints, or the capability table as a rollback shortcut.
