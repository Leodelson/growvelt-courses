# Growvelt Learning course moderation runbook

## Scope

`202608090010_course_moderation.sql` replaces legacy browser Admin course policies with Admin-only database RPCs. It supports only `pending_review → published` and `pending_review → draft`. It does not add payments, enrolment, playback, notifications, revision history, or private video delivery.

## Security model

The migration drops `Admins can read all learning courses` and `Admins can approve learning courses`. Browser table `UPDATE` was already revoked in Phase 2A-A; removing both policies ensures Admin course operations now use only the narrow RPCs below.

- `list_pending_learning_courses(integer, integer)` returns only pending queue fields.
- `get_learning_course_for_review(bigint)` returns one submitted-course snapshot, the latest declaration that is valid for that submission chronology, and its ordered curriculum.
- `review_learning_course(bigint, text, text)` locks a pending course and atomically publishes it or returns it to draft.

All three are `SECURITY DEFINER`, set an empty `search_path`, require `auth.uid()` and `is_growvelt_learning_admin()`, revoke execution from `PUBLIC`/`anon`, and grant it only to `authenticated`. Admin identity and current email are read through trusted `public.profiles` and `auth.users` joins within the Admin-authorized functions. Browser roles never receive direct access to `auth.users`, rights declarations, or course internal review fields.

## Moderation lifecycle

Only a secured Phase 2A-C submission can be published. The moderation RPC requires a pending course with `submitted_at`, current free-course pricing (`is_free`, zero price, NGN-compatible currency, and no limited-time-free flag), plus the latest matching `2026-08-v1` declaration for that course and Instructor accepted at or before `submitted_at`. Legacy or malformed pending records remain visible to Admin and can be returned to draft, but cannot be published.

- **Publish:** `pending_review → published`, writes `published_at`, `reviewed_at`, `reviewed_by`, optional `review_note`.
- **Return:** `pending_review → draft`, writes the review metadata and requires a `2–2000` character internal note. `submitted_at` is retained as the last submission time and is replaced on a later resubmission. Existing rights declarations are never deleted.

Returned Instructors see only a generic returned-to-draft state in this phase. `review_note` remains Admin-internal; no Instructor-visible note is introduced.

## Preconditions

1. Migrations 001 through 009 are applied and verified.
2. `learning_courses` has Phase 2A-C submission/review metadata and `course_rights_declarations` is RLS-enabled with no browser reads.
3. The two named legacy Admin course policies exist exactly as expected.
4. The approved Admin capability helper and submission RPC remain hardened.
5. No browser table `UPDATE` grant exists on `learning_courses`.

The migration is atomic and guarded. If a preflight fails, inspect the current production state; do not edit it to force execution.

## Execution and verification

1. Review migration 010 during an approved maintenance window.
2. Take the normal schema backup/export.
3. Execute migration 010 once.
4. Run verification queries before deploying the matching application source.

```sql
select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'learning_courses'
order by policyname;

select has_function_privilege('anon', 'public.review_learning_course(bigint,text,text)', 'EXECUTE') as anon_can_review,
       has_function_privilege('authenticated', 'public.review_learning_course(bigint,text,text)', 'EXECUTE') as authenticated_can_review,
       has_table_privilege('authenticated', 'public.learning_courses', 'UPDATE') as authenticated_can_update_courses,
       has_table_privilege('authenticated', 'public.course_rights_declarations', 'SELECT') as authenticated_can_read_declarations;

select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('list_pending_learning_courses', 'get_learning_course_for_review', 'review_learning_course');
```

Expected: no legacy Admin course policies; anonymous review execution is false; authenticated direct course update and declaration reads are false; all three RPCs are `DEFINER`.

## Functional verification

With a controlled Admin and an approved Instructor test course:

1. Submit a complete free draft through Phase 2A-C.
2. Confirm the Admin queue lists it once and the detail snapshot shows course metadata, Instructor identity, declaration, modules, and lessons.
3. Return it with a note. Confirm it becomes draft and existing Instructor metadata/curriculum RPCs work again.
4. Resubmit it, then publish it. Confirm it becomes published, `published_at` is set, and draft mutation RPCs reject it.
5. Confirm a Learner, non-Admin Instructor, and anon cannot read queue/detail data or review a course.
6. Confirm the existing public published-course/module/preview-lesson policies can read the published course without exposing review fields.

## Corrective guidance

Do not restore the dropped legacy Admin browser policies or a direct table `UPDATE` grant. If a correction is required, prepare a separate forward-only migration after inspecting the applied state. Future phases may add Instructor-visible revision notes, notification delivery, and an auditable review-event history; they are intentionally absent here.
