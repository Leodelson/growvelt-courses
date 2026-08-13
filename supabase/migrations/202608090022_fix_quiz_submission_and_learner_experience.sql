-- Phase 2C-A2 corrective migration: qualify learner-experience CTE columns
-- that collide with RETURNS TABLE variables, and recognise supported quiz
-- lessons at the existing secure course-submission boundary.
begin;

do $$
declare
  function_row regprocedure;
begin
  foreach function_row in array array[
    'public.submit_learning_course_for_review(bigint,text,text)'::regprocedure,
    'public.list_own_learning_course_experience(integer,integer)'::regprocedure,
    'public.get_own_enrolled_learning_course_experience_by_slug(text)'::regprocedure
  ] loop
    if not exists (
      select 1
      from pg_proc as procedure_row
      where procedure_row.oid = function_row
        and procedure_row.prosecdef
        and exists (
          select 1
          from unnest(coalesce(procedure_row.proconfig, array[]::text[])) as setting_row(setting_value)
          where split_part(setting_row.setting_value, '=', 1) = 'search_path'
            and replace(split_part(setting_row.setting_value, '=', 2), '"', '') = ''
        )
    )
      or has_function_privilege('public', function_row, 'EXECUTE')
      or has_function_privilege('anon', function_row, 'EXECUTE')
      or not has_function_privilege('authenticated', function_row, 'EXECUTE') then
      raise exception 'Learning corrective migration aborted: expected hardened baseline RPC is missing or insecure: %', function_row;
    end if;
  end loop;

  if not exists (
    select 1
    from pg_trigger as trigger_row
    where trigger_row.tgrelid = 'public.learning_courses'::regclass
      and trigger_row.tgname = 'learning_courses_quiz_readiness_before_submit'
      and not trigger_row.tgisinternal
      and (trigger_row.tgtype & 2) = 2
      and (trigger_row.tgtype & 16) = 16
      and (trigger_row.tgtype & 1) = 1
      and (
        select attribute_row.attnum
        from pg_attribute as attribute_row
        where attribute_row.attrelid = trigger_row.tgrelid
          and attribute_row.attname = 'status'
          and not attribute_row.attisdropped
      ) = any (trigger_row.tgattr)
      and trigger_row.tgfoid = 'public.validate_learning_course_quiz_readiness()'::regprocedure
  ) then
    raise exception 'Learning corrective migration aborted: expected quiz readiness trigger is missing';
  end if;
end;
$$;

create or replace function public.submit_learning_course_for_review(
  p_course_id bigint,
  p_declaration_version text,
  p_rights_basis text
)
returns table (
  course_id bigint,
  submission_status text,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  course_key bigint;
  submitted_time timestamptz;
  normalized_version text := btrim(p_declaration_version);
  normalized_basis text := lower(btrim(p_rights_basis));
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;

  if normalized_version is distinct from '2026-08-v1'
    or normalized_basis is null
    or normalized_basis not in ('original', 'licensed', 'authorized') then
    raise exception 'A current course-rights declaration is required' using errcode = '22023';
  end if;

  select course_row.id
  into course_key
  from public.learning_courses as course_row
  where course_row.id = p_course_id
    and course_row.instructor_id = auth.uid()
    and course_row.status = 'draft';

  if course_key is null then
    raise exception 'Draft course not found or is no longer editable' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(course_key);

  select course_row.id
  into course_key
  from public.learning_courses as course_row
  where course_row.id = course_key
    and course_row.instructor_id = auth.uid()
    and course_row.status = 'draft'
  for update;

  if course_key is null then
    raise exception 'Draft course not found or is no longer editable' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.learning_courses as course_row
    where course_row.id = course_key
      and char_length(btrim(course_row.title)) between 3 and 160
      and char_length(btrim(course_row.summary)) between 10 and 320
      and char_length(btrim(course_row.description)) between 40 and 10000
      and course_row.category in ('Data Analytics', 'Business', 'Data Science', 'Business Intelligence', 'Programming', 'Web Development', 'Cybersecurity', 'Digital Marketing', 'Creative Skills', 'Digital Skills', 'Productivity')
      and course_row.level in ('Beginner', 'Intermediate', 'Beginner to intermediate', 'Beginner to job-ready')
  ) then
    raise exception 'Complete the required course metadata before submitting' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.learning_courses as course_row
    where course_row.id = course_key
      and course_row.is_free = true
      and coalesce(course_row.price_amount, 0) = 0
      and coalesce(course_row.price_currency, 'NGN') = 'NGN'
      and coalesce(course_row.is_limited_time_free, false) = false
  ) then
    raise exception 'Only free courses can be submitted while secure paid delivery is unavailable' using errcode = '22023';
  end if;

  if not exists (select 1 from public.course_modules as module_row where module_row.course_id = course_key)
    or not exists (select 1 from public.lessons as lesson_row where lesson_row.course_id = course_key) then
    raise exception 'Add at least one module and one lesson before submitting' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.course_modules as module_row
    where module_row.course_id = course_key
      and (module_row.title is null or char_length(btrim(module_row.title)) not between 2 and 160)
  ) then
    raise exception 'Complete every module title before submitting' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.lessons as lesson_row
    left join public.course_modules as module_row
      on module_row.id = lesson_row.module_id
      and module_row.course_id = lesson_row.course_id
    where lesson_row.course_id = course_key
      and (
        module_row.id is null
        or char_length(btrim(lesson_row.title)) not between 2 and 160
        or lesson_row.lesson_type not in ('video', 'text', 'quiz')
        or (
          lesson_row.lesson_type = 'video'
          and (
            lesson_row.content is not null
            or lesson_row.video_provider is distinct from 'youtube'
            or lesson_row.video_reference is null
            or lesson_row.video_reference !~ '^[A-Za-z0-9_-]{11}$'
            or lesson_row.video_visibility not in ('public', 'unlisted')
            or lesson_row.duration_seconds not between 1 and 86400
            or lesson_row.video_url is not null
            or lesson_row.duration_minutes is not null
          )
        )
        or (
          lesson_row.lesson_type = 'text'
          and (
            lesson_row.content is null
            or char_length(btrim(lesson_row.content)) not between 1 and 20000
            or lesson_row.video_provider is not null
            or lesson_row.video_reference is not null
            or lesson_row.video_visibility is not null
            or lesson_row.duration_seconds is not null
            or lesson_row.video_url is not null
            or lesson_row.duration_minutes is not null
          )
        )
      )
  ) then
    raise exception 'Complete every lesson with valid text, YouTube video, or quiz details before submitting' using errcode = '22023';
  end if;

  insert into public.course_rights_declarations (
    course_id,
    instructor_id,
    declaration_version,
    rights_basis
  ) values (
    course_key,
    auth.uid(),
    normalized_version,
    normalized_basis
  );

  update public.learning_courses as course_row
  set status = 'pending_review',
      submitted_at = now(),
      reviewed_at = null,
      reviewed_by = null,
      review_note = null,
      updated_at = now()
  where course_row.id = course_key
    and course_row.instructor_id = auth.uid()
    and course_row.status = 'draft'
  returning course_row.submitted_at into submitted_time;

  if not found then
    raise exception 'Draft course not found or is no longer editable' using errcode = 'P0002';
  end if;

  return query
  select course_key, 'pending_review'::text, submitted_time;
end;
$$;

create or replace function public.list_own_learning_course_experience(
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  course_id bigint,
  slug text,
  title text,
  summary text,
  category text,
  level text,
  is_free boolean,
  instructor_name text,
  enrolled_at timestamptz,
  enrollment_status text,
  completed_lessons integer,
  total_lessons integer,
  progress_percent integer,
  resume_lesson_id bigint
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 48 or p_offset is null or p_offset < 0 then
    raise exception 'Invalid pagination' using errcode = '22023';
  end if;

  return query
  with own_enrollments as (
    select
      enrollment_row.id as source_enrollment_id,
      enrollment_row.course_id as source_course_id,
      enrollment_row.enrolled_at as source_enrolled_at,
      enrollment_row.status as source_enrollment_status
    from public.enrollments as enrollment_row
    where enrollment_row.learner_id = auth.uid()
      and enrollment_row.status in ('active', 'completed')
  ), activities as (
    select
      enrollment_row.source_enrollment_id,
      lesson_row.id as source_lesson_id,
      module_row.position as source_module_position,
      module_row.id as source_module_id,
      lesson_row.position as source_lesson_position,
      case
        when lesson_row.lesson_type in ('text', 'video') then coalesce(
          progress_row.completed_at is not null and progress_row.progress_percent = 100,
          false
        )
        when lesson_row.lesson_type = 'quiz' then exists (
          select 1
          from public.quiz_lessons as quiz_row
          join public.quiz_attempts as attempt_row on attempt_row.quiz_id = quiz_row.id
          where quiz_row.lesson_id = lesson_row.id
            and attempt_row.enrollment_id = enrollment_row.source_enrollment_id
            and attempt_row.passed
        )
        else false
      end as source_is_complete
    from own_enrollments as enrollment_row
    join public.course_modules as module_row on module_row.course_id = enrollment_row.source_course_id
    join public.lessons as lesson_row
      on lesson_row.course_id = enrollment_row.source_course_id
      and lesson_row.module_id = module_row.id
      and lesson_row.lesson_type in ('text', 'video', 'quiz')
    left join public.lesson_progress as progress_row
      on progress_row.enrollment_id = enrollment_row.source_enrollment_id
      and progress_row.lesson_id = lesson_row.id
  ), totals as (
    select
      activity_row.source_enrollment_id,
      count(*)::integer as source_total_lessons,
      count(*) filter (where activity_row.source_is_complete)::integer as source_completed_lessons
    from activities as activity_row
    group by activity_row.source_enrollment_id
  ), resume as (
    select distinct on (activity_row.source_enrollment_id)
      activity_row.source_enrollment_id,
      activity_row.source_lesson_id
    from activities as activity_row
    where not activity_row.source_is_complete
    order by
      activity_row.source_enrollment_id,
      activity_row.source_module_position,
      activity_row.source_module_id,
      activity_row.source_lesson_position,
      activity_row.source_lesson_id
  )
  select
    course_row.id,
    course_row.slug,
    course_row.title,
    course_row.summary,
    course_row.category,
    course_row.level,
    course_row.is_free,
    profile_row.full_name,
    enrollment_row.source_enrolled_at,
    enrollment_row.source_enrollment_status,
    coalesce(totals.source_completed_lessons, 0),
    coalesce(totals.source_total_lessons, 0),
    case
      when coalesce(totals.source_total_lessons, 0) = 0 then 0
      else least(100, (coalesce(totals.source_completed_lessons, 0) * 100) / totals.source_total_lessons)
    end,
    resume.source_lesson_id
  from own_enrollments as enrollment_row
  join public.learning_courses as course_row
    on course_row.id = enrollment_row.source_course_id
    and course_row.status = 'published'
  left join public.profiles as profile_row on profile_row.id = course_row.instructor_id
  left join totals on totals.source_enrollment_id = enrollment_row.source_enrollment_id
  left join resume on resume.source_enrollment_id = enrollment_row.source_enrollment_id
  order by enrollment_row.source_enrolled_at desc, course_row.id desc
  limit p_limit
  offset p_offset;
end;
$$;

create or replace function public.get_own_enrolled_learning_course_experience_by_slug(p_slug text)
returns table (
  course_id bigint,
  slug text,
  course_title text,
  summary text,
  description text,
  category text,
  level text,
  is_free boolean,
  instructor_name text,
  enrolled_at timestamptz,
  enrollment_status text,
  enrollment_completed_at timestamptz,
  completed_lessons integer,
  total_lessons integer,
  progress_percent integer,
  resume_lesson_id bigint,
  module_id bigint,
  module_title text,
  module_position integer,
  lesson_id bigint,
  lesson_title text,
  lesson_type text,
  lesson_completed boolean,
  is_preview boolean
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  normalized_slug text := lower(btrim(p_slug));
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if normalized_slug is null or normalized_slug = '' or char_length(normalized_slug) > 220 then
    raise exception 'Invalid course reference' using errcode = '22023';
  end if;

  return query
  with enrolled_course as (
    select
      enrollment_row.id as source_enrollment_id,
      enrollment_row.enrolled_at as source_enrolled_at,
      enrollment_row.status as source_enrollment_status,
      enrollment_row.completed_at as source_enrollment_completed_at,
      course_row.id as source_course_id,
      course_row.slug as source_course_slug,
      course_row.title as source_course_title,
      course_row.summary as source_summary,
      course_row.description as source_description,
      course_row.category as source_category,
      course_row.level as source_level,
      course_row.is_free as source_is_free,
      profile_row.full_name as source_instructor_name
    from public.enrollments as enrollment_row
    join public.learning_courses as course_row
      on course_row.id = enrollment_row.course_id
      and course_row.status = 'published'
    left join public.profiles as profile_row on profile_row.id = course_row.instructor_id
    where enrollment_row.learner_id = auth.uid()
      and enrollment_row.status in ('active', 'completed')
      and course_row.slug = normalized_slug
  ), course_rows as (
    select
      enrolled_course.source_enrollment_id,
      lesson_row.id as source_lesson_id,
      lesson_row.lesson_type as source_lesson_type,
      module_row.position as source_module_position,
      module_row.id as source_module_id,
      lesson_row.position as source_lesson_position,
      case
        when lesson_row.lesson_type in ('text', 'video') then coalesce(
          progress_row.completed_at is not null and progress_row.progress_percent = 100,
          false
        )
        when lesson_row.lesson_type = 'quiz' then exists (
          select 1
          from public.quiz_lessons as quiz_row
          join public.quiz_attempts as attempt_row on attempt_row.quiz_id = quiz_row.id
          where quiz_row.lesson_id = lesson_row.id
            and attempt_row.enrollment_id = enrolled_course.source_enrollment_id
            and attempt_row.passed
        )
        else false
      end as source_is_complete
    from enrolled_course
    join public.course_modules as module_row on module_row.course_id = enrolled_course.source_course_id
    join public.lessons as lesson_row
      on lesson_row.course_id = enrolled_course.source_course_id
      and lesson_row.module_id = module_row.id
    left join public.lesson_progress as progress_row
      on progress_row.enrollment_id = enrolled_course.source_enrollment_id
      and progress_row.lesson_id = lesson_row.id
  ), totals as (
    select
      course_row.source_enrollment_id,
      count(*) filter (where course_row.source_lesson_type in ('text', 'video', 'quiz'))::integer as source_total_lessons,
      count(*) filter (
        where course_row.source_lesson_type in ('text', 'video', 'quiz')
          and course_row.source_is_complete
      )::integer as source_completed_lessons
    from course_rows as course_row
    group by course_row.source_enrollment_id
  ), resume as (
    select distinct on (course_row.source_enrollment_id)
      course_row.source_enrollment_id,
      course_row.source_lesson_id
    from course_rows as course_row
    where course_row.source_lesson_type in ('text', 'video', 'quiz')
      and not course_row.source_is_complete
    order by
      course_row.source_enrollment_id,
      course_row.source_module_position,
      course_row.source_module_id,
      course_row.source_lesson_position,
      course_row.source_lesson_id
  )
  select
    enrolled_course.source_course_id,
    enrolled_course.source_course_slug,
    enrolled_course.source_course_title,
    enrolled_course.source_summary,
    enrolled_course.source_description,
    enrolled_course.source_category,
    enrolled_course.source_level,
    enrolled_course.source_is_free,
    enrolled_course.source_instructor_name,
    enrolled_course.source_enrolled_at,
    enrolled_course.source_enrollment_status,
    enrolled_course.source_enrollment_completed_at,
    coalesce(totals.source_completed_lessons, 0),
    coalesce(totals.source_total_lessons, 0),
    case
      when coalesce(totals.source_total_lessons, 0) = 0 then 0
      else least(100, (coalesce(totals.source_completed_lessons, 0) * 100) / totals.source_total_lessons)
    end,
    resume.source_lesson_id,
    module_row.id,
    module_row.title,
    module_row.position,
    lesson_row.id,
    lesson_row.title,
    lesson_row.lesson_type,
    coalesce(course_row.source_is_complete, false),
    lesson_row.is_preview
  from enrolled_course
  left join totals on totals.source_enrollment_id = enrolled_course.source_enrollment_id
  left join resume on resume.source_enrollment_id = enrolled_course.source_enrollment_id
  left join public.course_modules as module_row on module_row.course_id = enrolled_course.source_course_id
  left join public.lessons as lesson_row
    on lesson_row.course_id = enrolled_course.source_course_id
    and lesson_row.module_id = module_row.id
  left join course_rows as course_row
    on course_row.source_enrollment_id = enrolled_course.source_enrollment_id
    and course_row.source_lesson_id = lesson_row.id
  order by module_row.position, module_row.id, lesson_row.position, lesson_row.id;
end;
$$;

revoke execute on function public.submit_learning_course_for_review(bigint, text, text) from public, anon, authenticated;
revoke execute on function public.list_own_learning_course_experience(integer, integer) from public, anon, authenticated;
revoke execute on function public.get_own_enrolled_learning_course_experience_by_slug(text) from public, anon, authenticated;
grant execute on function public.submit_learning_course_for_review(bigint, text, text) to authenticated;
grant execute on function public.list_own_learning_course_experience(integer, integer) to authenticated;
grant execute on function public.get_own_enrolled_learning_course_experience_by_slug(text) to authenticated;

do $$
declare
  mismatch_row record;
begin
  if not exists (
    select 1
    from pg_trigger as trigger_row
    where trigger_row.tgrelid = 'public.learning_courses'::regclass
      and trigger_row.tgname = 'learning_courses_quiz_readiness_before_submit'
      and not trigger_row.tgisinternal
      and (trigger_row.tgtype & 2) = 2
      and (trigger_row.tgtype & 16) = 16
      and (trigger_row.tgtype & 1) = 1
      and (
        select attribute_row.attnum
        from pg_attribute as attribute_row
        where attribute_row.attrelid = trigger_row.tgrelid
          and attribute_row.attname = 'status'
          and not attribute_row.attisdropped
      ) = any (trigger_row.tgattr)
      and trigger_row.tgfoid = 'public.validate_learning_course_quiz_readiness()'::regprocedure
  ) then
    raise exception 'Learning corrective migration aborted: quiz readiness trigger changed unexpectedly';
  end if;

  for mismatch_row in
    with expected_contracts(function_oid, output_names, output_types) as (
      values
        ('public.submit_learning_course_for_review(bigint,text,text)'::regprocedure,
          array['course_id', 'submission_status', 'submitted_at'],
          array['bigint'::regtype, 'text'::regtype, 'timestamptz'::regtype]),
        ('public.list_own_learning_course_experience(integer,integer)'::regprocedure,
          array['course_id', 'slug', 'title', 'summary', 'category', 'level', 'is_free', 'instructor_name', 'enrolled_at', 'enrollment_status', 'completed_lessons', 'total_lessons', 'progress_percent', 'resume_lesson_id'],
          array['bigint'::regtype, 'text'::regtype, 'text'::regtype, 'text'::regtype, 'text'::regtype, 'text'::regtype, 'boolean'::regtype, 'text'::regtype, 'timestamptz'::regtype, 'text'::regtype, 'integer'::regtype, 'integer'::regtype, 'integer'::regtype, 'bigint'::regtype]),
        ('public.get_own_enrolled_learning_course_experience_by_slug(text)'::regprocedure,
          array['course_id', 'slug', 'course_title', 'summary', 'description', 'category', 'level', 'is_free', 'instructor_name', 'enrolled_at', 'enrollment_status', 'enrollment_completed_at', 'completed_lessons', 'total_lessons', 'progress_percent', 'resume_lesson_id', 'module_id', 'module_title', 'module_position', 'lesson_id', 'lesson_title', 'lesson_type', 'lesson_completed', 'is_preview'],
          array['bigint'::regtype, 'text'::regtype, 'text'::regtype, 'text'::regtype, 'text'::regtype, 'text'::regtype, 'text'::regtype, 'boolean'::regtype, 'text'::regtype, 'timestamptz'::regtype, 'text'::regtype, 'timestamptz'::regtype, 'integer'::regtype, 'integer'::regtype, 'integer'::regtype, 'bigint'::regtype, 'bigint'::regtype, 'text'::regtype, 'integer'::regtype, 'bigint'::regtype, 'text'::regtype, 'text'::regtype, 'boolean'::regtype, 'boolean'::regtype])
    ), expected_outputs as (
      select
        expected_contracts.function_oid,
        expected_name.value::text as output_name,
        expected_type.value::oid as output_type,
        expected_name.ordinality::integer as output_position
      from expected_contracts
      cross join lateral unnest(expected_contracts.output_names) with ordinality as expected_name(value, ordinality)
      cross join lateral unnest(expected_contracts.output_types) with ordinality as expected_type(value, ordinality)
      where expected_name.ordinality = expected_type.ordinality
    ), actual_outputs as (
      select
        procedure_row.oid as function_oid,
        argument_row.argument_name::text as output_name,
        argument_row.argument_type as output_type,
        row_number() over (partition by procedure_row.oid order by argument_row.ordinality)::integer as output_position,
        argument_row.argument_mode as output_mode
      from pg_proc as procedure_row
      cross join lateral unnest(procedure_row.proallargtypes, procedure_row.proargmodes, procedure_row.proargnames)
        with ordinality as argument_row(argument_type, argument_mode, argument_name, ordinality)
      where procedure_row.oid in (select function_oid from expected_contracts)
        and argument_row.argument_mode in ('t'::"char", 'o'::"char")
    )
    select
      coalesce(expected_outputs.function_oid, actual_outputs.function_oid) as function_oid,
      coalesce(expected_outputs.output_position, actual_outputs.output_position) as output_position,
      expected_outputs.output_name as expected_name,
      expected_outputs.output_type as expected_type,
      actual_outputs.output_name as actual_name,
      actual_outputs.output_type as actual_type,
      actual_outputs.output_mode as actual_mode
    from expected_outputs
    full join actual_outputs
      on actual_outputs.function_oid = expected_outputs.function_oid
      and actual_outputs.output_position = expected_outputs.output_position
    where expected_outputs.output_position is null
      or actual_outputs.output_position is null
      or expected_outputs.output_name <> actual_outputs.output_name
      or expected_outputs.output_type <> actual_outputs.output_type
    order by 1, 2
    limit 1
  loop
    raise exception 'Learning corrective migration aborted: return contract mismatch for %', mismatch_row.function_oid::regprocedure
      using detail = format(
        'position %s: expected %s %s; actual %s %s (mode %s)',
        mismatch_row.output_position,
        coalesce(mismatch_row.expected_name, '<none>'),
        coalesce(format_type(mismatch_row.expected_type, null), '<none>'),
        coalesce(mismatch_row.actual_name, '<none>'),
        coalesce(format_type(mismatch_row.actual_type, null), '<none>'),
        coalesce(mismatch_row.actual_mode::text, '<none>')
      );
  end loop;

  if exists (
    select 1
    from pg_proc as procedure_row
    where procedure_row.oid in (
      'public.submit_learning_course_for_review(bigint,text,text)'::regprocedure,
      'public.list_own_learning_course_experience(integer,integer)'::regprocedure,
      'public.get_own_enrolled_learning_course_experience_by_slug(text)'::regprocedure
    )
      and (
        not procedure_row.prosecdef
        or not exists (
          select 1
          from unnest(coalesce(procedure_row.proconfig, array[]::text[])) as setting_row(setting_value)
          where split_part(setting_row.setting_value, '=', 1) = 'search_path'
            and replace(split_part(setting_row.setting_value, '=', 2), '"', '') = ''
        )
        or has_function_privilege('public', procedure_row.oid, 'EXECUTE')
        or has_function_privilege('anon', procedure_row.oid, 'EXECUTE')
        or not has_function_privilege('authenticated', procedure_row.oid, 'EXECUTE')
      )
  ) then
    raise exception 'Learning corrective migration aborted: RPC security or execute grants are not hardened';
  end if;
end;
$$;

commit;
