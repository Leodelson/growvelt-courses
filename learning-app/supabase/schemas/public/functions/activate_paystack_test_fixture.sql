create or replace function public.activate_paystack_test_fixture (
  p_course_id           bigint,
  p_tester_id           uuid,
  p_operator_id         uuid,
  p_expires_at          timestamp with time zone,
  p_declaration_version text,
  p_rights_basis        text
)
  returns table (
    fixture_id bigint,
    course_id  bigint,
    tester_id  uuid,
    expires_at timestamp with time zone
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  course_row record;
  fixture_key bigint;
  normalized_basis text := lower(btrim(p_rights_basis));
begin
  if p_course_id is null or p_tester_id is null or p_operator_id is null or p_expires_at is null then
    raise exception 'Course, tester, operator, and expiry are required' using errcode = '22023';
  end if;
  if p_expires_at <= now() + interval '15 minutes' or p_expires_at > now() + interval '24 hours' then
    raise exception 'Fixture expiry must be between 15 minutes and 24 hours from now' using errcode = '22023';
  end if;
  if btrim(coalesce(p_declaration_version, '')) <> '2026-08-v1'
    or normalized_basis not in ('original', 'licensed', 'authorized') then
    raise exception 'A current course-rights declaration is required' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.account_capabilities capability
    where capability.user_id = p_operator_id and capability.capability = 'admin' and capability.status = 'active'
  ) then raise exception 'An active Growvelt Learning administrator is required' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = p_tester_id) then
    raise exception 'Disposable learner profile was not found' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.account_capabilities capability
    where capability.user_id = p_tester_id and capability.status = 'active' and capability.capability in ('admin', 'instructor')
  ) then raise exception 'Fixture tester must be a learner-only disposable account' using errcode = '22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended('phase1a-test-fixture', 0));
  if exists (select 1 from public.learning_paystack_test_fixtures where status = 'active') then
    raise exception 'An active Paystack test fixture already exists' using errcode = '23505';
  end if;

  select course.* into course_row from public.learning_courses course
  where course.id = p_course_id and course.status = 'draft' for update;
  if not found then raise exception 'Paid test course must be an editable draft' using errcode = 'P0002'; end if;
  if course_row.slug !~ '^phase1a-paystack-test-[a-z0-9-]+$' or course_row.title !~ '^\[TEST\] ' then
    raise exception 'Fixture course must use the reserved test title and slug markers' using errcode = '22023';
  end if;
  if course_row.instructor_id is null or not exists (
    select 1 from public.account_capabilities capability
    where capability.user_id = course_row.instructor_id and capability.capability = 'instructor' and capability.status = 'active'
  ) then raise exception 'Fixture course must belong to an approved instructor' using errcode = '42501'; end if;
  if course_row.is_free or course_row.is_limited_time_free or course_row.price_amount is null
    or course_row.price_amount <= 0 or course_row.price_currency <> 'NGN' or scale(course_row.price_amount) > 2 then
    raise exception 'Fixture course must have an eligible paid NGN price' using errcode = '22023';
  end if;
  if char_length(btrim(course_row.title)) not between 3 and 160
    or char_length(btrim(course_row.summary)) not between 10 and 320
    or char_length(btrim(course_row.description)) not between 40 and 10000
    or course_row.category not in ('Data Analytics','Business','Data Science','Business Intelligence','Programming','Web Development','Cybersecurity','Digital Marketing','Creative Skills','Digital Skills','Productivity')
    or course_row.level not in ('Beginner','Intermediate','Beginner to intermediate','Beginner to job-ready') then
    raise exception 'Complete the required test-course metadata before activation' using errcode = '22023';
  end if;
  if not exists (select 1 from public.course_modules module where module.course_id = p_course_id)
    or not exists (select 1 from public.lessons lesson where lesson.course_id = p_course_id) then
    raise exception 'Add at least one module and one lesson before activation' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.course_modules module where module.course_id = p_course_id
      and char_length(btrim(module.title)) not between 2 and 160
  ) then raise exception 'Complete every module title before activation' using errcode = '22023'; end if;
  if exists (
    select 1 from public.lessons lesson
    left join public.course_modules module on module.id = lesson.module_id and module.course_id = lesson.course_id
    where lesson.course_id = p_course_id and (
      module.id is null or char_length(btrim(lesson.title)) not between 2 and 160
      or lesson.lesson_type not in ('video','text','quiz')
      or (lesson.lesson_type = 'video' and (lesson.content is not null or lesson.video_provider is distinct from 'youtube'
        or lesson.video_reference is null or lesson.video_reference !~ '^[A-Za-z0-9_-]{11}$'
        or lesson.video_visibility not in ('public','unlisted') or lesson.duration_seconds not between 1 and 86400
        or lesson.video_url is not null or lesson.duration_minutes is not null))
      or (lesson.lesson_type = 'text' and (lesson.content is null or char_length(btrim(lesson.content)) not between 1 and 20000
        or lesson.video_provider is not null or lesson.video_reference is not null or lesson.video_visibility is not null
        or lesson.duration_seconds is not null or lesson.video_url is not null or lesson.duration_minutes is not null))
    )
  ) then raise exception 'Complete every lesson before activation' using errcode = '22023'; end if;

  insert into public.course_rights_declarations(course_id, instructor_id, declaration_version, rights_basis)
  values (p_course_id, course_row.instructor_id, '2026-08-v1', normalized_basis);
  update public.learning_courses set status = 'published', submitted_at = now(), reviewed_at = now(), reviewed_by = p_operator_id,
    review_note = 'Phase 1A controlled Paystack test fixture', published_at = now(), updated_at = now()
  where id = p_course_id and status = 'draft';
  if not found then raise exception 'Test course changed during activation' using errcode = '40001'; end if;

  insert into public.learning_paystack_test_fixtures(course_id, tester_id, expires_at, activated_by)
  values (p_course_id, p_tester_id, p_expires_at, p_operator_id) returning id into fixture_key;
  insert into public.learning_audit_events(actor_user_id, actor_role, action, entity_type, entity_id, metadata)
  values (p_operator_id, 'admin_operator', 'paystack_test_fixture.activated', 'paystack_test_fixture', fixture_key::text,
    jsonb_build_object('course_id', p_course_id, 'tester_id', p_tester_id, 'expires_at', p_expires_at));
  return query select fixture_key, p_course_id, p_tester_id, p_expires_at;
end;$function$;

grant execute on function "public"."activate_paystack_test_fixture"(bigint, uuid, uuid, timestamp with time zone, text, text) to "postgres", "service_role";

revoke all on function "public"."activate_paystack_test_fixture"(bigint, uuid, uuid, timestamp with time zone, text, text) from public;
