-- Phase 0C repeatable multi-user authorization suite.
-- The runner permits only the isolated local container on host port 55432.
-- Every identity, course, enrollment, attempt, certificate and audit row is rolled back.

begin;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  is_sso_user, is_anonymous
) values
  ('00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'learner-a@phase0c.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Learner A"}', now(), now(), false, false),
  ('00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'learner-b@phase0c.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Learner B"}', now(), now(), false, false),
  ('00000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'instructor-a@phase0c.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Instructor A"}', now(), now(), false, false),
  ('00000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'instructor-b@phase0c.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Instructor B"}', now(), now(), false, false),
  ('00000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'admin@phase0c.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Admin"}', now(), now(), false, false);

insert into public.instructor_profiles (user_id, headline, bio, approval_status, reviewed_at)
values
  ('00000000-0000-4000-8000-000000000003', 'Instructor A', 'Phase 0C fixture instructor A', 'approved', now()),
  ('00000000-0000-4000-8000-000000000004', 'Instructor B', 'Phase 0C fixture instructor B', 'approved', now());

insert into public.account_capabilities (user_id, capability, status)
values
  ('00000000-0000-4000-8000-000000000003', 'instructor', 'active'),
  ('00000000-0000-4000-8000-000000000004', 'instructor', 'active'),
  ('00000000-0000-4000-8000-000000000005', 'admin', 'active');

insert into public.learning_courses (
  instructor_id, title, slug, summary, description, level, category,
  is_free, price_amount, price_currency, is_limited_time_free, status, published_at
) values
  ('00000000-0000-4000-8000-000000000003', 'Phase 0C Free Course', 'phase0c-free-course', 'Free fixture', 'Free fixture course', 'Beginner', 'Business', true, 0, 'NGN', false, 'published', now()),
  ('00000000-0000-4000-8000-000000000003', 'Phase 0C Paid Course', 'phase0c-paid-course', 'Paid fixture', 'Paid fixture course', 'Beginner', 'Business', false, 10000, 'NGN', false, 'published', now()),
  ('00000000-0000-4000-8000-000000000003', 'Phase 0C Draft Course', 'phase0c-draft-course', 'Draft fixture', 'Draft fixture course', 'Beginner', 'Business', true, 0, 'NGN', false, 'draft', null),
  ('00000000-0000-4000-8000-000000000003', 'Phase 0C Archived Course', 'phase0c-archived-course', 'Archived fixture', 'Archived fixture course', 'Beginner', 'Business', true, 0, 'NGN', false, 'archived', null),
  ('00000000-0000-4000-8000-000000000003', 'Phase 0C Limited Course', 'phase0c-limited-course', 'Limited fixture', 'Limited fixture course', 'Beginner', 'Business', true, 0, 'NGN', true, 'published', now()),
  ('00000000-0000-4000-8000-000000000004', 'Phase 0C Foreign Draft', 'phase0c-foreign-draft', 'Foreign draft', 'Foreign draft fixture', 'Beginner', 'Business', true, 0, 'NGN', false, 'draft', null),
  ('00000000-0000-4000-8000-000000000004', 'Phase 0C Foreign Published', 'phase0c-foreign-published', 'Foreign published', 'Foreign published fixture', 'Beginner', 'Business', true, 0, 'NGN', false, 'published', now());

select set_config('phase0c.free_course', (select id::text from public.learning_courses where slug = 'phase0c-free-course'), true);
select set_config('phase0c.paid_course', (select id::text from public.learning_courses where slug = 'phase0c-paid-course'), true);
select set_config('phase0c.draft_course', (select id::text from public.learning_courses where slug = 'phase0c-draft-course'), true);
select set_config('phase0c.archived_course', (select id::text from public.learning_courses where slug = 'phase0c-archived-course'), true);
select set_config('phase0c.limited_course', (select id::text from public.learning_courses where slug = 'phase0c-limited-course'), true);
select set_config('phase0c.foreign_draft', (select id::text from public.learning_courses where slug = 'phase0c-foreign-draft'), true);
select set_config('phase0c.foreign_published', (select id::text from public.learning_courses where slug = 'phase0c-foreign-published'), true);

insert into public.course_modules (course_id, title, position)
values
  (current_setting('phase0c.free_course')::bigint, 'Core module', 1),
  (current_setting('phase0c.foreign_draft')::bigint, 'Foreign module', 1),
  (current_setting('phase0c.foreign_published')::bigint, 'Foreign published module', 1);

select set_config('phase0c.free_module', (select id::text from public.course_modules where course_id = current_setting('phase0c.free_course')::bigint), true);
select set_config('phase0c.foreign_module', (select id::text from public.course_modules where course_id = current_setting('phase0c.foreign_draft')::bigint), true);

insert into public.lessons (course_id, module_id, title, lesson_type, content, is_preview, position)
values
  (current_setting('phase0c.free_course')::bigint, current_setting('phase0c.free_module')::bigint, 'Text lesson', 'text', 'Fixture content', false, 1),
  (current_setting('phase0c.free_course')::bigint, current_setting('phase0c.free_module')::bigint, 'Quiz lesson', 'quiz', null, false, 2),
  (current_setting('phase0c.foreign_draft')::bigint, current_setting('phase0c.foreign_module')::bigint, 'Foreign draft lesson', 'text', 'Foreign fixture', false, 1),
  (current_setting('phase0c.foreign_published')::bigint, (select id from public.course_modules where course_id = current_setting('phase0c.foreign_published')::bigint), 'Foreign private lesson', 'text', 'Not a preview', false, 1);

select set_config('phase0c.text_lesson', (select id::text from public.lessons where title = 'Text lesson'), true);
select set_config('phase0c.quiz_lesson', (select id::text from public.lessons where title = 'Quiz lesson'), true);
select set_config('phase0c.foreign_private_lesson', (select id::text from public.lessons where title = 'Foreign private lesson'), true);

insert into public.quiz_lessons (lesson_id, course_id, instructions, passing_percentage)
values (current_setting('phase0c.quiz_lesson')::bigint, current_setting('phase0c.free_course')::bigint, 'Choose correctly', 70);
select set_config('phase0c.quiz', (select id::text from public.quiz_lessons where lesson_id = current_setting('phase0c.quiz_lesson')::bigint), true);

insert into public.quiz_questions (quiz_id, question_text, position)
values (current_setting('phase0c.quiz')::bigint, 'Which answer is correct?', 1);
select set_config('phase0c.question', (select id::text from public.quiz_questions where quiz_id = current_setting('phase0c.quiz')::bigint), true);

insert into public.quiz_options (question_id, option_text, position, is_correct)
values
  (current_setting('phase0c.question')::bigint, 'Correct', 1, true),
  (current_setting('phase0c.question')::bigint, 'Incorrect', 2, false);
select set_config('phase0c.correct_option', (select id::text from public.quiz_options where question_id = current_setting('phase0c.question')::bigint and is_correct), true);

insert into public.enrollments (learner_id, course_id, status)
values
  ('00000000-0000-4000-8000-000000000001', current_setting('phase0c.free_course')::bigint, 'active'),
  ('00000000-0000-4000-8000-000000000002', current_setting('phase0c.free_course')::bigint, 'active');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $learner_tests$
declare
  blocked boolean;
  visible_count integer;
  changed_count integer;
  first_enrollment_id bigint;
  second_enrollment_id bigint;
  candidate_course_id bigint;
  quiz_score integer;
  quiz_passed boolean;
  first_certificate_code text;
  second_certificate_code text;
begin
  select count(*) into visible_count from public.profiles;
  if visible_count <> 1 then raise exception 'Profile isolation failed: saw % rows', visible_count; end if;

  blocked := false;
  changed_count := 0;
  begin
    with changed as (
      update public.profiles set full_name = full_name
      where id = '00000000-0000-4000-8000-000000000002' returning 1
    ) select count(*) into changed_count from changed;
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked and changed_count <> 0 then raise exception 'Foreign profile update succeeded'; end if;

  select count(*) into visible_count from public.enrollments
  where learner_id = '00000000-0000-4000-8000-000000000002';
  if visible_count <> 0 then raise exception 'Foreign enrollment was visible'; end if;

  blocked := false;
  begin update public.profiles set account_type = 'admin' where id = auth.uid();
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Learner changed account_type'; end if;

  blocked := false;
  begin
    insert into public.account_capabilities (user_id, capability, status)
    values (auth.uid(), 'admin', 'active');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Capability self-grant succeeded'; end if;

  blocked := false;
  begin perform public.review_instructor_application(auth.uid(), 'approved', null);
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Learner executed admin instructor moderation'; end if;

  blocked := false;
  begin perform public.review_learning_course(current_setting('phase0c.draft_course')::bigint, 'approved', null);
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Learner executed admin course moderation'; end if;

  blocked := false;
  begin perform public.create_instructor_course_draft('Unauthorized', 'Unauthorized course', 'No permission', 'Beginner', 'Business', true, 0, 'NGN');
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Learner created instructor course'; end if;

  foreach candidate_course_id in array array[
    current_setting('phase0c.paid_course')::bigint,
    current_setting('phase0c.draft_course')::bigint,
    current_setting('phase0c.archived_course')::bigint,
    current_setting('phase0c.limited_course')::bigint
  ] loop
    blocked := false;
    begin perform public.enroll_in_free_learning_course(candidate_course_id);
    exception when others then blocked := true;
    end;
    if not blocked then raise exception 'Invalid course % accepted free enrollment', candidate_course_id; end if;
  end loop;

  select enrollment_id into first_enrollment_id
  from public.enroll_in_free_learning_course(current_setting('phase0c.free_course')::bigint);
  select enrollment_id into second_enrollment_id
  from public.enroll_in_free_learning_course(current_setting('phase0c.free_course')::bigint);
  if first_enrollment_id is distinct from second_enrollment_id then raise exception 'Free enrollment is not idempotent'; end if;

  select count(*) into visible_count from public.lessons
  where id = current_setting('phase0c.foreign_private_lesson')::bigint;
  if visible_count <> 0 then raise exception 'Unenrolled private lesson was readable'; end if;

  blocked := false;
  begin perform public.complete_own_enrolled_lesson(current_setting('phase0c.foreign_published')::bigint, current_setting('phase0c.foreign_private_lesson')::bigint);
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Learner completed an unenrolled lesson'; end if;

  if has_table_privilege('authenticated', 'public.quiz_options', 'SELECT') then
    raise exception 'Correct quiz answers are directly readable';
  end if;

  blocked := false;
  begin perform public.issue_own_learning_certificate(current_setting('phase0c.free_course')::bigint);
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Certificate issued before completion'; end if;

  perform public.complete_own_enrolled_lesson(current_setting('phase0c.free_course')::bigint, current_setting('phase0c.text_lesson')::bigint);

  blocked := false;
  begin
    perform public.submit_own_quiz_attempt(
      'phase0c-free-course', current_setting('phase0c.quiz_lesson')::bigint,
      jsonb_build_array(jsonb_build_object('question_id', current_setting('phase0c.question')::bigint, 'option_id', 999999999))
    );
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Foreign quiz option was accepted'; end if;

  select result.score_percentage, result.passed
  into quiz_score, quiz_passed
  from public.submit_own_quiz_attempt(
    'phase0c-free-course', current_setting('phase0c.quiz_lesson')::bigint,
    jsonb_build_array(jsonb_build_object('question_id', current_setting('phase0c.question')::bigint, 'option_id', current_setting('phase0c.correct_option')::bigint))
  ) as result;

  if quiz_score <> 100 or not quiz_passed then
    raise exception 'Database-side quiz scoring did not return a passing 100%% attempt';
  end if;

  select result.certificate_code into first_certificate_code
  from public.issue_own_learning_certificate(current_setting('phase0c.free_course')::bigint) as result;
  select result.certificate_code into second_certificate_code
  from public.issue_own_learning_certificate(current_setting('phase0c.free_course')::bigint) as result;
  if first_certificate_code is null or first_certificate_code is distinct from second_certificate_code then
    raise exception 'Certificate issuance was not idempotent';
  end if;

  blocked := false;
  begin update public.certificates set learner_name = 'Forged' where learner_id = auth.uid();
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Learner modified certificate snapshot'; end if;
end
$learner_tests$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);

do $instructor_tests$
declare blocked boolean; changed_count integer; listed_count integer; foreign_count integer;
begin
  select count(*), count(*) filter (where course_id in (
    current_setting('phase0c.foreign_draft')::bigint,
    current_setting('phase0c.foreign_published')::bigint
  ))
  into listed_count, foreign_count
  from public.search_own_instructor_courses(null, null, 12, 0);
  if listed_count <> 5 or foreign_count <> 0 then
    raise exception 'Instructor course listing returned own=% foreign=%', listed_count, foreign_count;
  end if;

  blocked := false;
  begin perform public.archive_own_instructor_course(current_setting('phase0c.foreign_published')::bigint);
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Instructor archived a foreign course'; end if;

  blocked := false;
  begin perform public.update_instructor_course_module(current_setting('phase0c.foreign_module')::bigint, 'Hijacked');
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Instructor edited a foreign module'; end if;

  blocked := false;
  changed_count := 0;
  begin
    with changed as (
      update public.learning_courses set title = title
      where id = current_setting('phase0c.foreign_draft')::bigint returning 1
    ) select count(*) into changed_count from changed;
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked and changed_count <> 0 then raise exception 'Direct foreign course update succeeded'; end if;

  if public.can_manage_learning_course_video_cover(
    '00000000-0000-4000-8000-000000000004/' || current_setting('phase0c.foreign_draft') || '/course-video-cover'
  ) then raise exception 'Instructor can manage a foreign course cover path'; end if;
end
$instructor_tests$;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

do $anonymous_tests$
declare visible_count integer; public_detail_count integer;
begin
  select count(*) into visible_count from public.profiles;
  if visible_count <> 0 then raise exception 'Anonymous profile enumeration succeeded'; end if;

  select count(*) into visible_count from public.lessons
  where id = current_setting('phase0c.foreign_private_lesson')::bigint;
  if visible_count <> 0 then raise exception 'Anonymous private lesson read succeeded'; end if;

  select count(*) into public_detail_count
  from public.get_published_learning_course_by_slug('phase0c-free-course');
  if public_detail_count = 0 then raise exception 'Anonymous published course detail was unavailable'; end if;

  perform public.submit_public_learning_inquiry(
    'contact', 'Phase Zero', 'phase0c@example.invalid', 'Security test inquiry',
    'This rollback-only inquiry verifies the intended anonymous RPC remains available.',
    null, null, null
  );
end
$anonymous_tests$;

reset role;

do $audit_tests$
declare blocked boolean; audit_count integer;
begin
  select count(*) into audit_count from public.learning_audit_events;
  if audit_count < 4 then raise exception 'Expected fixture security events, found %', audit_count; end if;

  blocked := false;
  begin update public.learning_audit_events set action = action where id = (select min(id) from public.learning_audit_events);
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Audit event update succeeded'; end if;

  blocked := false;
  begin delete from public.learning_audit_events where id = (select min(id) from public.learning_audit_events);
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Audit event deletion succeeded'; end if;
end
$audit_tests$;

rollback;
