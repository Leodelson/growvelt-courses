-- Phase 0D account-deletion and certificate-retention regression suite.
-- The local runner restricts execution to the isolated Docker database.
-- All fixtures and mutations are rolled back.

begin;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  is_sso_user, is_anonymous
) values
  ('00000000-0000-4000-9000-000000000001', 'authenticated', 'authenticated', 'keep@phase0d.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Keep Learner"}', now(), now(), false, false),
  ('00000000-0000-4000-9000-000000000002', 'authenticated', 'authenticated', 'remove@phase0d.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Remove Learner"}', now(), now(), false, false),
  ('00000000-0000-4000-9000-000000000003', 'authenticated', 'authenticated', 'admin@phase0d.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Managed Admin"}', now(), now(), false, false),
  ('00000000-0000-4000-9000-000000000004', 'authenticated', 'authenticated', 'instructor@phase0d.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Managed Instructor"}', now(), now(), false, false);

insert into public.account_capabilities (user_id, capability, status)
values ('00000000-0000-4000-9000-000000000003', 'admin', 'active');

insert into public.instructor_profiles (user_id, headline, bio, approval_status, reviewed_at)
values ('00000000-0000-4000-9000-000000000004', 'Instructor', 'Phase 0D fixture', 'approved', now());

insert into public.account_capabilities (user_id, capability, status)
values ('00000000-0000-4000-9000-000000000004', 'instructor', 'active');

insert into public.learning_courses (
  instructor_id, title, slug, summary, description, level, category,
  is_free, price_amount, price_currency, is_limited_time_free, status, published_at
) values
  ('00000000-0000-4000-9000-000000000004', 'Phase 0D Course', 'phase0d-course', 'Fixture', 'Fixture', 'Beginner', 'Business', true, 0, 'NGN', false, 'published', now());

select set_config('phase0d.course', (select id::text from public.learning_courses where slug = 'phase0d-course'), true);

insert into public.course_modules (course_id, title, position)
values (current_setting('phase0d.course')::bigint, 'Phase 0D module', 1);
select set_config('phase0d.module', (select id::text from public.course_modules where course_id = current_setting('phase0d.course')::bigint), true);

insert into public.lessons (course_id, module_id, title, lesson_type, position)
values (current_setting('phase0d.course')::bigint, current_setting('phase0d.module')::bigint, 'Phase 0D quiz', 'quiz', 1);
select set_config('phase0d.lesson', (select id::text from public.lessons where course_id = current_setting('phase0d.course')::bigint), true);

insert into public.quiz_lessons (lesson_id, course_id, instructions, passing_percentage)
values (current_setting('phase0d.lesson')::bigint, current_setting('phase0d.course')::bigint, 'Fixture quiz', 70);
select set_config('phase0d.quiz', (select id::text from public.quiz_lessons where course_id = current_setting('phase0d.course')::bigint), true);

insert into public.enrollments (learner_id, course_id, status, completed_at)
values
  ('00000000-0000-4000-9000-000000000001', current_setting('phase0d.course')::bigint, 'completed', now()),
  ('00000000-0000-4000-9000-000000000002', current_setting('phase0d.course')::bigint, 'completed', now());

insert into public.certificates (
  learner_id, course_id, certificate_code, learner_name, course_title,
  instructor_name, completed_at, status
) values
  ('00000000-0000-4000-9000-000000000001', current_setting('phase0d.course')::bigint, 'PHASE0DKEEP', 'Keep Learner', 'Phase 0D Course', 'Managed Instructor', now(), 'issued'),
  ('00000000-0000-4000-9000-000000000002', current_setting('phase0d.course')::bigint, 'PHASE0DREMOVE', 'Remove Learner', 'Phase 0D Course', 'Managed Instructor', now(), 'issued');

-- A restrictive quiz-attempt relationship previously prevented enrollment/account deletion.
insert into public.quiz_attempts (
  learner_id, enrollment_id, course_id, quiz_id,
  correct_answer_count, total_question_count, score_percentage, passed
)
select '00000000-0000-4000-9000-000000000002', enrollment.id, enrollment.course_id,
  current_setting('phase0d.quiz')::bigint, 0, 1, 0, false
from public.enrollments as enrollment
where enrollment.learner_id = '00000000-0000-4000-9000-000000000002';

set local role authenticated;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $keep_preflight$
declare result_row record;
begin
  select * into result_row from public.request_own_learning_account_deletion('keep_verifiable');
  if result_row.outcome <> 'ready' or result_row.certificate_count <> 1 then
    raise exception 'Keep-certificate preflight returned unexpected result';
  end if;
end
$keep_preflight$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000002', true);

do $remove_preflight$
declare result_row record;
begin
  select * into result_row from public.request_own_learning_account_deletion('remove_public_verification');
  if result_row.outcome <> 'ready' or result_row.certificate_count <> 1 then
    raise exception 'Remove-verification preflight returned unexpected result';
  end if;
end
$remove_preflight$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000003', true);

do $admin_preflight$
declare result_row record;
begin
  select * into result_row from public.request_own_learning_account_deletion('remove_public_verification');
  if result_row.outcome <> 'admin_offboarding_required' then
    raise exception 'Active administrator was not routed to managed offboarding';
  end if;
end
$admin_preflight$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000004', true);

do $instructor_preflight$
declare result_row record;
begin
  select * into result_row from public.request_own_learning_account_deletion('remove_public_verification');
  if result_row.outcome <> 'instructor_offboarding_required' then
    raise exception 'Instructor with content was not routed to managed offboarding';
  end if;
end
$instructor_preflight$;

reset role;

delete from auth.users where id = '00000000-0000-4000-9000-000000000001';
delete from auth.users where id = '00000000-0000-4000-9000-000000000002';

do $retention_assertions$
declare verify_row record;
begin
  if exists (select 1 from public.profiles where id in ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-9000-000000000002')) then
    raise exception 'Learner profile survived Auth deletion';
  end if;

  if not exists (
    select 1 from public.certificates
    where certificate_code = 'PHASE0DKEEP'
      and learner_id is null
      and learner_name = 'Keep Learner'
      and status = 'issued'
      and retention_state = 'preserved_after_account_deletion'
      and account_deleted_at is not null
  ) then raise exception 'Keep-verifiable certificate was not preserved correctly'; end if;

  select * into verify_row from public.verify_learning_certificate('PHASE0DKEEP');
  if not verify_row.is_valid or verify_row.learner_name <> 'Keep Learner' then
    raise exception 'Preserved certificate is not publicly verifiable';
  end if;

  if not exists (
    select 1 from public.certificates
    where certificate_code = 'PHASE0DREMOVE'
      and learner_id is null
      and learner_name is null
      and status = 'revoked'
      and revoked_at is not null
      and retention_state = 'anonymized_after_account_deletion'
      and account_deleted_at is not null
  ) then raise exception 'Remove-verification certificate was not anonymized correctly'; end if;

  select * into verify_row from public.verify_learning_certificate('PHASE0DREMOVE');
  if verify_row.is_valid or verify_row.learner_name is not null then
    raise exception 'Anonymized certificate remained publicly valid or named';
  end if;

  if exists (select 1 from public.quiz_attempts where learner_id = '00000000-0000-4000-9000-000000000002') then
    raise exception 'Dependent quiz attempt survived learner deletion';
  end if;
end
$retention_assertions$;

do $managed_deletion_guards$
declare blocked boolean;
begin
  blocked := false;
  begin delete from public.profiles where id = '00000000-0000-4000-9000-000000000003';
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Active administrator profile deletion was not blocked'; end if;

  blocked := false;
  begin delete from public.profiles where id = '00000000-0000-4000-9000-000000000004';
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Instructor-owned content deletion was not blocked'; end if;
end
$managed_deletion_guards$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-9000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $request_table_isolation$
declare exposed integer;
begin
  if has_table_privilege('authenticated', 'public.learning_account_deletion_requests', 'SELECT') then
    raise exception 'Authenticated role has direct deletion-request table access';
  end if;
  select count(*) into exposed from public.learning_account_deletion_requests;
  if exposed <> 0 then raise exception 'Deletion-request records were exposed through RLS'; end if;
exception when insufficient_privilege then
  null;
end
$request_table_isolation$;

rollback;
