-- Growvelt Learning Phase 2B-G: narrow learner progress/read snapshots for resume UX.
-- Forward-only. This migration adds no browser table access and no new mutations.

begin;

do $$
declare
  function_name regprocedure;
begin
  if to_regclass('public.enrollments') is null
    or to_regclass('public.lesson_progress') is null
    or to_regclass('public.learning_courses') is null
    or to_regclass('public.course_modules') is null
    or to_regclass('public.lessons') is null then
    raise exception 'Learner experience reads aborted: expected Learning relations are missing';
  end if;

  if to_regclass('public.profiles') is null then
    raise exception 'Learner experience reads aborted: expected profiles relation is missing';
  end if;
  if exists (
    select 1
    from pg_class as relation_row
    join pg_namespace as namespace_row on namespace_row.oid = relation_row.relnamespace
    where namespace_row.nspname = 'public'
      and relation_row.relname in ('enrollments', 'lesson_progress', 'learning_courses', 'course_modules', 'lessons', 'profiles')
      and not relation_row.relrowsecurity
  ) then
    raise exception 'Learner experience reads aborted: RLS must remain enabled on all learner-facing relations';
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'enrollments' and column_name = 'id' and data_type = 'bigint')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'enrollments' and column_name = 'learner_id' and data_type = 'uuid')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'enrollments' and column_name = 'course_id' and data_type = 'bigint')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'enrollments' and column_name = 'status' and data_type = 'text')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'enrollments' and column_name = 'enrolled_at' and data_type = 'timestamp with time zone')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'enrollments' and column_name = 'completed_at' and data_type = 'timestamp with time zone')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lesson_progress' and column_name = 'enrollment_id' and data_type = 'bigint')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lesson_progress' and column_name = 'lesson_id' and data_type = 'bigint')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lesson_progress' and column_name = 'completed_at' and data_type = 'timestamp with time zone')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lesson_progress' and column_name = 'progress_percent' and data_type = 'integer')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'id' and data_type = 'bigint')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'instructor_id' and data_type = 'uuid')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'slug' and data_type = 'text')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'title' and data_type = 'text')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'summary' and data_type = 'text')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'description' and data_type = 'text')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'category' and data_type = 'text')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'level' and data_type = 'text')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'is_free' and data_type = 'boolean')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'status' and data_type = 'text')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'course_modules' and column_name = 'id' and data_type = 'bigint')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'course_modules' and column_name = 'course_id' and data_type = 'bigint')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'course_modules' and column_name = 'title' and data_type = 'text')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'course_modules' and column_name = 'position' and data_type = 'integer')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'id' and data_type = 'bigint')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'course_id' and data_type = 'bigint')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'module_id' and data_type = 'bigint')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'title' and data_type = 'text')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'lesson_type' and data_type = 'text')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'is_preview' and data_type = 'boolean')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'position' and data_type = 'integer')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'id' and data_type = 'uuid')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'full_name' and data_type = 'text') then
    raise exception 'Learner experience reads aborted: expected relation column shape is missing';
  end if;

  foreach function_name in array array[
    'public.list_own_learning_course_progress(integer,integer)'::regprocedure,
    'public.get_own_enrolled_learning_course_progress_by_slug(text)'::regprocedure,
    'public.get_own_enrolled_lesson_snapshot(text,bigint)'::regprocedure
  ] loop
    if not exists (
      select 1
      from pg_proc as procedure_row
      where procedure_row.oid = function_name
        and procedure_row.prosecdef
        and exists (
          select 1
          from unnest(coalesce(procedure_row.proconfig, array[]::text[])) as setting_row(setting_value)
          where split_part(setting_row.setting_value, '=', 1) = 'search_path'
            and replace(split_part(setting_row.setting_value, '=', 2), '"', '') = ''
        )
    )
      or has_function_privilege('public', function_name, 'EXECUTE')
      or has_function_privilege('anon', function_name, 'EXECUTE')
      or not has_function_privilege('authenticated', function_name, 'EXECUTE') then
      raise exception 'Learner experience reads aborted: expected hardened baseline function % is missing', function_name;
    end if;
  end loop;

  if pg_get_function_result('public.list_own_learning_course_progress(integer,integer)'::regprocedure) <> 'TABLE(course_id bigint, slug text, title text, summary text, category text, level text, is_free boolean, instructor_name text, enrolled_at timestamp with time zone, enrollment_status text, completed_lessons integer, total_lessons integer, progress_percent integer)'
    or pg_get_function_result('public.get_own_enrolled_learning_course_progress_by_slug(text)'::regprocedure) <> 'TABLE(course_id bigint, slug text, course_title text, summary text, description text, category text, level text, is_free boolean, instructor_name text, enrolled_at timestamp with time zone, enrollment_status text, enrollment_completed_at timestamp with time zone, completed_lessons integer, total_lessons integer, progress_percent integer, module_id bigint, module_title text, module_position integer, lesson_id bigint, lesson_title text, lesson_type text, is_preview boolean)'
    or pg_get_function_result('public.get_own_enrolled_lesson_snapshot(text,bigint)'::regprocedure) <> 'TABLE(course_id bigint, course_slug text, course_title text, enrollment_id bigint, module_id bigint, module_title text, module_position integer, lesson_id bigint, lesson_title text, lesson_type text, lesson_position integer, is_preview boolean, is_current boolean, is_completed boolean, current_text_content text, current_video_provider text, current_video_reference text, current_video_visibility text, current_duration_seconds integer, previous_lesson_id bigint, next_lesson_id bigint)' then
    raise exception 'Learner experience reads aborted: expected baseline RPC result contract is missing';
  end if;

  if to_regprocedure('public.list_own_learning_course_experience(integer,integer)') is not null
    or to_regprocedure('public.get_own_enrolled_learning_course_experience_by_slug(text)') is not null then
    raise exception 'Learner experience reads aborted: partial Phase 2B-G RPC state already exists';
  end if;
end;
$$;

-- Returns one row per own active/completed enrollment, plus the first incomplete eligible lesson.
-- Eligible lessons are intentionally limited to the currently supported text/video player types.
create function public.list_own_learning_course_experience(p_limit integer default 24, p_offset integer default 0)
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
language plpgsql security definer stable set search_path = ''
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
    select enrollment_row.id as enrollment_id, enrollment_row.course_id, enrollment_row.enrolled_at, enrollment_row.status
    from public.enrollments as enrollment_row
    where enrollment_row.learner_id = auth.uid()
      and enrollment_row.status in ('active', 'completed')
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
    enrollment_row.enrolled_at,
    enrollment_row.status,
    coalesce(totals.completed_lessons, 0),
    coalesce(totals.total_lessons, 0),
    case
      when coalesce(totals.total_lessons, 0) = 0 then 0
      else least(100, (coalesce(totals.completed_lessons, 0) * 100) / totals.total_lessons)
    end,
    resume_lesson.lesson_id
  from own_enrollments as enrollment_row
  join public.learning_courses as course_row
    on course_row.id = enrollment_row.course_id
    and course_row.status = 'published'
  left join public.profiles as profile_row on profile_row.id = course_row.instructor_id
  left join lateral (
    select
      count(lesson_row.id)::integer as total_lessons,
      count(lesson_row.id) filter (
        where progress_row.completed_at is not null and progress_row.progress_percent = 100
      )::integer as completed_lessons
    from public.course_modules as module_row
    join public.lessons as lesson_row
      on lesson_row.course_id = enrollment_row.course_id
      and lesson_row.module_id = module_row.id
      and lesson_row.lesson_type in ('text', 'video')
    left join public.lesson_progress as progress_row
      on progress_row.enrollment_id = enrollment_row.enrollment_id
      and progress_row.lesson_id = lesson_row.id
    where module_row.course_id = enrollment_row.course_id
  ) as totals on true
  left join lateral (
    select lesson_row.id as lesson_id
    from public.course_modules as module_row
    join public.lessons as lesson_row
      on lesson_row.course_id = enrollment_row.course_id
      and lesson_row.module_id = module_row.id
      and lesson_row.lesson_type in ('text', 'video')
    left join public.lesson_progress as progress_row
      on progress_row.enrollment_id = enrollment_row.enrollment_id
      and progress_row.lesson_id = lesson_row.id
    where module_row.course_id = enrollment_row.course_id
      and (progress_row.completed_at is null or progress_row.progress_percent <> 100)
    order by module_row.position, module_row.id, lesson_row.position, lesson_row.id
    limit 1
  ) as resume_lesson on true
  order by enrollment_row.enrolled_at desc, course_row.id desc
  limit p_limit offset p_offset;
end;
$$;

-- One own-enrollment course snapshot: progress, per-lesson completion, and the next eligible lesson.
create function public.get_own_enrolled_learning_course_experience_by_slug(p_slug text)
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
language plpgsql security definer stable set search_path = ''
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
      enrollment_row.id as own_enrollment_id,
      enrollment_row.enrolled_at,
      enrollment_row.status as own_enrollment_status,
      enrollment_row.completed_at as own_enrollment_completed_at,
      course_row.id as own_course_id,
      course_row.slug as own_course_slug,
      course_row.title as own_course_title,
      course_row.summary as own_summary,
      course_row.description as own_description,
      course_row.category as own_category,
      course_row.level as own_level,
      course_row.is_free as own_is_free,
      profile_row.full_name as own_instructor_name
    from public.enrollments as enrollment_row
    join public.learning_courses as course_row
      on course_row.id = enrollment_row.course_id
      and course_row.status = 'published'
    left join public.profiles as profile_row on profile_row.id = course_row.instructor_id
    where enrollment_row.learner_id = auth.uid()
      and enrollment_row.status in ('active', 'completed')
      and course_row.slug = normalized_slug
  ), eligible_lessons as (
    select
      enrolled_course.own_enrollment_id,
      module_row.id as source_module_id,
      module_row.position as source_module_position,
      lesson_row.id as source_lesson_id,
      lesson_row.position as source_lesson_position,
      coalesce(progress_row.completed_at is not null and progress_row.progress_percent = 100, false) as source_completed
    from enrolled_course
    join public.course_modules as module_row on module_row.course_id = enrolled_course.own_course_id
    join public.lessons as lesson_row
      on lesson_row.course_id = enrolled_course.own_course_id
      and lesson_row.module_id = module_row.id
      and lesson_row.lesson_type in ('text', 'video')
    left join public.lesson_progress as progress_row
      on progress_row.enrollment_id = enrolled_course.own_enrollment_id
      and progress_row.lesson_id = lesson_row.id
  ), totals as (
    select
      count(eligible_lessons.source_lesson_id)::integer as total_lessons,
      count(eligible_lessons.source_lesson_id) filter (where eligible_lessons.source_completed)::integer as completed_lessons
    from eligible_lessons
  ), resume_lesson as (
    select eligible_lessons.source_lesson_id as lesson_id
    from eligible_lessons
    where not eligible_lessons.source_completed
    order by eligible_lessons.source_module_position, eligible_lessons.source_module_id, eligible_lessons.source_lesson_position, eligible_lessons.source_lesson_id
    limit 1
  ), curriculum_rows as (
    select
      module_row.id as source_module_id,
      module_row.title as source_module_title,
      module_row.position as source_module_position,
      lesson_row.id as source_lesson_id,
      lesson_row.title as source_lesson_title,
      lesson_row.lesson_type as source_lesson_type,
      lesson_row.position as source_lesson_position,
      lesson_row.is_preview as source_is_preview,
      case
        when lesson_row.lesson_type in ('text', 'video') then coalesce(eligible_lessons.source_completed, false)
        else false
      end as source_lesson_completed
    from enrolled_course
    join public.course_modules as module_row on module_row.course_id = enrolled_course.own_course_id
    left join public.lessons as lesson_row
      on lesson_row.course_id = enrolled_course.own_course_id
      and lesson_row.module_id = module_row.id
    left join eligible_lessons on eligible_lessons.source_lesson_id = lesson_row.id
    order by module_row.position, module_row.id, lesson_row.position, lesson_row.id
  )
  select
    enrolled_course.own_course_id,
    enrolled_course.own_course_slug,
    enrolled_course.own_course_title,
    enrolled_course.own_summary,
    enrolled_course.own_description,
    enrolled_course.own_category,
    enrolled_course.own_level,
    enrolled_course.own_is_free,
    enrolled_course.own_instructor_name,
    enrolled_course.enrolled_at,
    enrolled_course.own_enrollment_status,
    enrolled_course.own_enrollment_completed_at,
    coalesce(totals.completed_lessons, 0),
    coalesce(totals.total_lessons, 0),
    case
      when coalesce(totals.total_lessons, 0) = 0 then 0
      else least(100, (coalesce(totals.completed_lessons, 0) * 100) / totals.total_lessons)
    end,
    resume_lesson.lesson_id,
    curriculum_rows.source_module_id,
    curriculum_rows.source_module_title,
    curriculum_rows.source_module_position,
    curriculum_rows.source_lesson_id,
    curriculum_rows.source_lesson_title,
    curriculum_rows.source_lesson_type,
    curriculum_rows.source_lesson_completed,
    curriculum_rows.source_is_preview
  from enrolled_course
  cross join totals
  left join resume_lesson on true
  left join curriculum_rows on true
  order by curriculum_rows.source_module_position, curriculum_rows.source_module_id, curriculum_rows.source_lesson_position, curriculum_rows.source_lesson_id;
end;
$$;

revoke execute on function public.list_own_learning_course_experience(integer,integer), public.get_own_enrolled_learning_course_experience_by_slug(text) from public, anon, authenticated;
grant execute on function public.list_own_learning_course_experience(integer,integer), public.get_own_enrolled_learning_course_experience_by_slug(text) to authenticated;

do $$
declare
  function_name regprocedure;
begin
  foreach function_name in array array[
    'public.list_own_learning_course_experience(integer,integer)'::regprocedure,
    'public.get_own_enrolled_learning_course_experience_by_slug(text)'::regprocedure
  ] loop
    if not exists (
      select 1
      from pg_proc as procedure_row
      where procedure_row.oid = function_name
        and procedure_row.prosecdef
        and exists (
          select 1
          from unnest(coalesce(procedure_row.proconfig, array[]::text[])) as setting_row(setting_value)
          where split_part(setting_row.setting_value, '=', 1) = 'search_path'
            and replace(split_part(setting_row.setting_value, '=', 2), '"', '') = ''
        )
    )
      or has_function_privilege('public', function_name, 'EXECUTE')
      or has_function_privilege('anon', function_name, 'EXECUTE')
      or not has_function_privilege('authenticated', function_name, 'EXECUTE') then
      raise exception 'Learner experience reads aborted: new RPC grants or security are not hardened for %', function_name;
    end if;
  end loop;

  if pg_get_function_result('public.list_own_learning_course_experience(integer,integer)'::regprocedure) <> 'TABLE(course_id bigint, slug text, title text, summary text, category text, level text, is_free boolean, instructor_name text, enrolled_at timestamp with time zone, enrollment_status text, completed_lessons integer, total_lessons integer, progress_percent integer, resume_lesson_id bigint)'
    or pg_get_function_result('public.get_own_enrolled_learning_course_experience_by_slug(text)'::regprocedure) <> 'TABLE(course_id bigint, slug text, course_title text, summary text, description text, category text, level text, is_free boolean, instructor_name text, enrolled_at timestamp with time zone, enrollment_status text, enrollment_completed_at timestamp with time zone, completed_lessons integer, total_lessons integer, progress_percent integer, resume_lesson_id bigint, module_id bigint, module_title text, module_position integer, lesson_id bigint, lesson_title text, lesson_type text, lesson_completed boolean, is_preview boolean)' then
    raise exception 'Learner experience reads aborted: new RPC result contract is not hardened';
  end if;
end;
$$;

commit;
