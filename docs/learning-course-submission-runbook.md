# Growvelt Learning course submission safety runbook

## Scope

`202608090009_course_submission_safety.sql` adds the secure Instructor submission transition only: an approved Instructor can submit an owned, complete free draft from `draft` to `pending_review`. It does not add Admin course moderation, publishing, payments, enrolment, notifications, learner playback, or private video delivery.

## Security model

The migration adds `submitted_at`, `reviewed_at`, `reviewed_by`, and `review_note` to `public.learning_courses`. `reviewed_by` references `public.profiles(id)` and both `reviewed_by` and `review_note` are Admin-internal. The migration replaces broad browser `SELECT` on `learning_courses` with safe column-level `SELECT` for `anon` and `authenticated`, preserving every existing course column except those two internal fields. RLS continues to control rows; the existing published-course policy remains the public-read boundary.

`public.course_rights_declarations` is RLS-enabled with no browser grants or policies. It records one immutable declaration for each successful submission attempt. The database derives the Instructor from `auth.uid()`; callers never supply it.

The sole browser submission path is `submit_learning_course_for_review(bigint,text,text)`. It is `SECURITY DEFINER`, uses an empty `search_path`, checks `auth.uid()` and `is_approved_growvelt_instructor()`, verifies ownership, acquires the existing per-course advisory lock, revalidates the draft, validates every required field, inserts the declaration, and updates the course status in one transaction. `anon` has no execution grant; only `authenticated` can execute it.

## Paid-course rule

Phase 2A-C accepts submissions for **free courses only**. A public or unlisted YouTube reference is not secure paid-content delivery. Paid draft metadata remains editable, but a paid course cannot be submitted until entitlement and managed/private delivery architecture exists.

## Preconditions

1. Migrations 001 through 008 are applied and verified.
2. `learning_courses`, `course_modules`, and `lessons` retain RLS, the expected lifecycle, and the Phase 2A authoring RPCs.
3. No direct browser `INSERT` or `UPDATE` remains on `learning_courses`.
4. The production maintenance window includes review of the migration and the verification queries below.

The migration has an explicit transaction and guarded preflight. If a guard fails, do not modify it to force execution; inspect the live baseline first.

## Execution order

1. Review migration 009 against the production schema.
2. Take the normal approved schema backup/export.
3. Execute migration 009 once through the controlled Supabase SQL workflow.
4. Run verification queries.
5. Deploy the matching application source.
6. With a non-production approved Instructor, submit one complete free draft and confirm it becomes read-only with `pending_review` status.

## Verification SQL

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'learning_courses'
  and column_name in ('submitted_at', 'reviewed_at', 'reviewed_by', 'review_note')
order by column_name;

select relrowsecurity
from pg_class
where oid = 'public.course_rights_declarations'::regclass;

select has_function_privilege('anon', 'public.submit_learning_course_for_review(bigint,text,text)', 'EXECUTE') as anon_can_submit,
       has_function_privilege('authenticated', 'public.submit_learning_course_for_review(bigint,text,text)', 'EXECUTE') as authenticated_can_submit,
       has_table_privilege('authenticated', 'public.course_rights_declarations', 'INSERT') as authenticated_can_insert_declaration,
       has_table_privilege('authenticated', 'public.learning_courses', 'DELETE') as authenticated_can_delete_course,
       has_column_privilege('authenticated', 'public.learning_courses', 'reviewed_by', 'SELECT') as authenticated_can_read_reviewer,
       has_column_privilege('authenticated', 'public.learning_courses', 'review_note', 'SELECT') as authenticated_can_read_review_note;

select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'learning_courses'
order by policyname;
```

Expected: RLS is true for declarations; anonymous RPC execution is false; authenticated execution is true; browser declaration insertion and browser reads of internal review fields are false; the existing published-course read policy remains.

## Functional checks

1. An approved Instructor submits a complete free draft with one module and one valid text or YouTube lesson, selects a rights basis, accepts the declaration, and receives `pending_review`.
2. Verify one matching immutable rights-declaration row has the authenticated Instructor UUID and version `2026-08-v1`.
3. Confirm draft metadata and curriculum mutation RPCs reject the resulting pending-review course.
4. Confirm incomplete metadata, missing curriculum, invalid lesson fields, an unchecked declaration, and paid drafts are rejected.
5. Confirm a Learner, pending Instructor applicant, non-owner Instructor, and anon cannot submit.
6. Confirm published-course browser reads still work without returning `reviewed_by` or `review_note`.

## Corrective strategy

Do not restore browser course mutation grants, direct browser declaration access, or internal review-column reads if an old prototype page breaks. Those paths bypass the intended review boundary. If production correction is needed, create a separately reviewed forward-only migration after inspecting the exact applied state. This migration creates no Admin moderation action and does not send email.

Legacy course Admin policies, if still present from the prototype schema, are not used by this checkpoint: Phase 2A-A removed the authenticated table `UPDATE` grant needed to exercise them from a browser. Phase 2A-D must replace any remaining legacy Admin direct-mutation path with a narrow capability-checked review RPC before course moderation is enabled.
