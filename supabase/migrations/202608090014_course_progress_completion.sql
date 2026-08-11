-- Growvelt Learning Phase 2B-D: derive course progress from secure lesson completion.
-- Forward-only. Completed enrollments retain lesson access; cancelled enrollments do not.

begin;

do $$
declare function_name regprocedure;
begin
  if to_regclass('public.enrollments') is null or to_regclass('public.lesson_progress') is null then
    raise exception 'Course progress aborted: expected enrollment/progress relations are missing';
  end if;
  if to_regprocedure('public.complete_own_enrolled_lesson(bigint,bigint)') is null
    or to_regprocedure('public.get_own_enrolled_lesson_snapshot(text,bigint)') is null
    or to_regprocedure('public.get_own_enrolled_learning_course_by_slug(text)') is null
    or to_regprocedure('public.get_own_learning_enrollment_state(bigint)') is null then
    raise exception 'Course progress aborted: expected Phase 2B-C enrollment RPCs are missing';
  end if;
  foreach function_name in array array[
    'public.enroll_in_free_learning_course(bigint)'::regprocedure,
    'public.get_own_learning_enrollment_state(bigint)'::regprocedure,
    'public.get_own_enrolled_lesson_snapshot(text,bigint)'::regprocedure,
    'public.complete_own_enrolled_lesson(bigint,bigint)'::regprocedure
  ] loop
    if not exists (
      select 1 from pg_proc as procedure_row
      where procedure_row.oid = function_name
        and procedure_row.prosecdef
        and exists (
          select 1
          from unnest(coalesce(procedure_row.proconfig, array[]::text[])) as setting_row(setting_value)
          where split_part(setting_row.setting_value, '=', 1) = 'search_path'
            and replace(split_part(setting_row.setting_value, '=', 2), '"', '') = ''
        )
    ) or not has_function_privilege('authenticated', function_name, 'EXECUTE')
      or has_function_privilege('public', function_name, 'EXECUTE')
      or has_function_privilege('anon', function_name, 'EXECUTE') then
      raise exception 'Course progress aborted: expected hardened baseline function % is missing', function_name;
    end if;
  end loop;
  if pg_get_function_result('public.enroll_in_free_learning_course(bigint)'::regprocedure) <> 'TABLE(enrollment_id bigint, enrollment_status text)'
    or pg_get_function_result('public.get_own_learning_enrollment_state(bigint)'::regprocedure) not like '%is_enrolled boolean, enrollment_status text, enrolled_at timestamp with time zone%'
    or pg_get_function_result('public.complete_own_enrolled_lesson(bigint,bigint)'::regprocedure) not like '%completed_lesson_id bigint, completed_at timestamp with time zone, progress_percent integer%'
    or pg_get_function_result('public.get_own_enrolled_lesson_snapshot(text,bigint)'::regprocedure) not like '%course_id bigint%current_text_content text%next_lesson_id bigint%' then
    raise exception 'Course progress aborted: expected baseline function result shape is missing';
  end if;
  if to_regprocedure('public.list_own_learning_course_progress(integer,integer)') is not null
    or to_regprocedure('public.get_own_enrolled_learning_course_progress_by_slug(text)') is not null then
    raise exception 'Course progress aborted: partial Phase 2B-D RPC state already exists';
  end if;
  if not exists (
    select 1 from pg_constraint as constraint_row
    where constraint_row.conrelid = 'public.enrollments'::regclass
      and constraint_row.contype = 'c'
      and pg_get_constraintdef(constraint_row.oid) ilike '%active%'
      and pg_get_constraintdef(constraint_row.oid) ilike '%completed%'
      and pg_get_constraintdef(constraint_row.oid) ilike '%cancelled%'
  ) then raise exception 'Course progress aborted: expected enrollment lifecycle is missing'; end if;
  if exists (select 1 from pg_class as relation_row join pg_namespace as namespace_row on namespace_row.oid = relation_row.relnamespace where namespace_row.nspname = 'public' and relation_row.relname in ('enrollments', 'lesson_progress') and not relation_row.relrowsecurity) then
    raise exception 'Course progress aborted: RLS must remain enabled';
  end if;
end;
$$;

-- Preserve durable completion. Only a cancelled enrollment may be reactivated.
create or replace function public.enroll_in_free_learning_course(p_course_id bigint)
returns table (enrollment_id bigint, enrollment_status text)
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform 1
  from public.learning_courses as course_row
  where course_row.id = p_course_id
    and course_row.status = 'published'
    and course_row.is_free = true
    and coalesce(course_row.price_amount, 0) = 0
    and coalesce(course_row.price_currency, 'NGN') = 'NGN'
    and coalesce(course_row.is_limited_time_free, false) = false
  for share;
  if not found then
    raise exception 'This course is not currently available for free enrollment' using errcode = '22023';
  end if;
  -- enrolled_at remains the original enrollment timestamp for deterministic ordering.
  insert into public.enrollments (learner_id, course_id, status)
  values (auth.uid(), p_course_id, 'active')
  on conflict (learner_id, course_id) do update
    set status = 'active', completed_at = null
    where enrollments.status = 'cancelled';
  return query
  select enrollment_row.id, enrollment_row.status
  from public.enrollments as enrollment_row
  where enrollment_row.learner_id = auth.uid() and enrollment_row.course_id = p_course_id;
end;
$$;

-- A completed enrollment remains an enrollment everywhere a learner-facing CTA checks it.
create or replace function public.get_own_learning_enrollment_state(p_course_id bigint)
returns table (is_enrolled boolean, enrollment_status text, enrolled_at timestamptz)
language plpgsql security definer stable set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  return query select true, enrollment_row.status, enrollment_row.enrolled_at
  from public.enrollments as enrollment_row
  join public.learning_courses as course_row on course_row.id = enrollment_row.course_id and course_row.status = 'published'
  where enrollment_row.learner_id = auth.uid() and enrollment_row.course_id = p_course_id and enrollment_row.status in ('active', 'completed');
  if not found then return query select false, null::text, null::timestamptz; end if;
end;
$$;

-- One narrow learner list read. A lesson is complete only when its persisted completion is 100.
create function public.list_own_learning_course_progress(p_limit integer default 24, p_offset integer default 0)
returns table (course_id bigint, slug text, title text, summary text, category text, level text, is_free boolean, instructor_name text, enrolled_at timestamptz, enrollment_status text, completed_lessons integer, total_lessons integer, progress_percent integer)
language plpgsql security definer stable set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 48 or p_offset is null or p_offset < 0 then raise exception 'Invalid pagination' using errcode = '22023'; end if;
  return query
  with own_enrollments as (
    select enrollment_row.id, enrollment_row.course_id, enrollment_row.enrolled_at, enrollment_row.status
    from public.enrollments as enrollment_row
    where enrollment_row.learner_id = auth.uid() and enrollment_row.status in ('active', 'completed')
  ), lesson_totals as (
    select enrollment_row.id as enrollment_id, count(lesson_row.id)::integer as total_lessons,
      count(lesson_row.id) filter (where progress_row.completed_at is not null and progress_row.progress_percent = 100)::integer as completed_lessons
    from own_enrollments as enrollment_row
    join public.course_modules as module_row on module_row.course_id = enrollment_row.course_id
    join public.lessons as lesson_row on lesson_row.course_id = enrollment_row.course_id and lesson_row.module_id = module_row.id and lesson_row.lesson_type in ('text', 'video')
    left join public.lesson_progress as progress_row on progress_row.enrollment_id = enrollment_row.id and progress_row.lesson_id = lesson_row.id
    group by enrollment_row.id
  )
  select course_row.id, course_row.slug, course_row.title, course_row.summary, course_row.category, course_row.level, course_row.is_free, profile_row.full_name, enrollment_row.enrolled_at, enrollment_row.status,
    coalesce(totals.completed_lessons, 0), coalesce(totals.total_lessons, 0),
    case when coalesce(totals.total_lessons, 0) = 0 then 0 else least(100, (coalesce(totals.completed_lessons, 0) * 100) / totals.total_lessons) end
  from own_enrollments as enrollment_row
  join public.learning_courses as course_row on course_row.id = enrollment_row.course_id and course_row.status = 'published'
  left join public.profiles as profile_row on profile_row.id = course_row.instructor_id
  left join lesson_totals as totals on totals.enrollment_id = enrollment_row.id
  order by enrollment_row.enrolled_at desc, course_row.id desc limit p_limit offset p_offset;
end;
$$;

-- Snapshot repeats course-level progress per curriculum row so the client needs only one RPC.
create function public.get_own_enrolled_learning_course_progress_by_slug(p_slug text)
returns table (course_id bigint, slug text, course_title text, summary text, description text, category text, level text, is_free boolean, instructor_name text, enrolled_at timestamptz, enrollment_status text, enrollment_completed_at timestamptz, completed_lessons integer, total_lessons integer, progress_percent integer, module_id bigint, module_title text, module_position integer, lesson_id bigint, lesson_title text, lesson_type text, is_preview boolean)
language plpgsql security definer stable set search_path = ''
as $$
declare normalized_slug text := lower(btrim(p_slug));
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if normalized_slug is null or normalized_slug = '' or char_length(normalized_slug) > 220 then raise exception 'Invalid course reference' using errcode = '22023'; end if;
  return query
  with enrolled_course as (
    select enrollment_row.id as enrollment_id, enrollment_row.enrolled_at, enrollment_row.status as enrollment_status, enrollment_row.completed_at as enrollment_completed_at, course_row.id, course_row.slug, course_row.title, course_row.summary, course_row.description, course_row.category, course_row.level, course_row.is_free, profile_row.full_name
    from public.enrollments as enrollment_row join public.learning_courses as course_row on course_row.id = enrollment_row.course_id and course_row.status = 'published'
    left join public.profiles as profile_row on profile_row.id = course_row.instructor_id
    where enrollment_row.learner_id = auth.uid() and enrollment_row.status in ('active', 'completed') and course_row.slug = normalized_slug
  ), totals as (
    select count(lesson_row.id)::integer as total_lessons, count(lesson_row.id) filter (where progress_row.completed_at is not null and progress_row.progress_percent = 100)::integer as completed_lessons
    from enrolled_course join public.course_modules as module_row on module_row.course_id = enrolled_course.id join public.lessons as lesson_row on lesson_row.course_id = enrolled_course.id and lesson_row.module_id = module_row.id and lesson_row.lesson_type in ('text', 'video') left join public.lesson_progress as progress_row on progress_row.enrollment_id = enrolled_course.enrollment_id and progress_row.lesson_id = lesson_row.id
  )
  select enrolled_course.id, enrolled_course.slug, enrolled_course.title, enrolled_course.summary, enrolled_course.description, enrolled_course.category, enrolled_course.level, enrolled_course.is_free, enrolled_course.full_name, enrolled_course.enrolled_at, enrolled_course.enrollment_status, enrolled_course.enrollment_completed_at, coalesce(totals.completed_lessons, 0), coalesce(totals.total_lessons, 0), case when coalesce(totals.total_lessons, 0) = 0 then 0 else least(100, (coalesce(totals.completed_lessons, 0) * 100) / totals.total_lessons) end, module_row.id, module_row.title, module_row.position, lesson_row.id, lesson_row.title, lesson_row.lesson_type, lesson_row.is_preview
  from enrolled_course cross join totals left join public.course_modules as module_row on module_row.course_id = enrolled_course.id left join public.lessons as lesson_row on lesson_row.course_id = enrolled_course.id and lesson_row.module_id = module_row.id
  order by module_row.position, module_row.id, lesson_row.position, lesson_row.id;
end;
$$;

-- Completed learners retain access; no completion is written merely by opening a lesson.
create or replace function public.get_own_enrolled_lesson_snapshot(p_slug text, p_lesson_id bigint)
returns table (course_id bigint, course_slug text, course_title text, enrollment_id bigint, module_id bigint, module_title text, module_position integer, lesson_id bigint, lesson_title text, lesson_type text, lesson_position integer, is_preview boolean, is_current boolean, is_completed boolean, current_text_content text, current_video_provider text, current_video_reference text, current_video_visibility text, current_duration_seconds integer, previous_lesson_id bigint, next_lesson_id bigint)
language plpgsql security definer stable set search_path = ''
as $$ begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  return query with enrolled_course as (select course_row.id, course_row.slug, course_row.title, enrollment_row.id as enrollment_id from public.enrollments as enrollment_row join public.learning_courses as course_row on course_row.id = enrollment_row.course_id and course_row.status = 'published' where enrollment_row.learner_id = auth.uid() and enrollment_row.status in ('active','completed') and course_row.slug = lower(btrim(p_slug))), ordered_lessons as (select enrolled_course.id as course_id, enrolled_course.slug, enrolled_course.title as course_title, enrolled_course.enrollment_id, module_row.id as module_id, module_row.title as module_title, module_row.position as module_position, lesson_row.id as current_lesson_id, lesson_row.title as current_lesson_title, lesson_row.lesson_type as current_lesson_type, lesson_row.position as lesson_position, lesson_row.is_preview, lesson_row.content, lesson_row.video_provider, lesson_row.video_reference, lesson_row.video_visibility, lesson_row.duration_seconds, progress_row.completed_at, lag(lesson_row.id) over (order by module_row.position,module_row.id,lesson_row.position,lesson_row.id) as previous_id, lead(lesson_row.id) over (order by module_row.position,module_row.id,lesson_row.position,lesson_row.id) as next_id from enrolled_course join public.course_modules as module_row on module_row.course_id=enrolled_course.id join public.lessons as lesson_row on lesson_row.course_id=enrolled_course.id and lesson_row.module_id=module_row.id left join public.lesson_progress as progress_row on progress_row.enrollment_id=enrolled_course.enrollment_id and progress_row.lesson_id=lesson_row.id) select course_id,slug,course_title,enrollment_id,module_id,module_title,module_position,current_lesson_id,current_lesson_title,current_lesson_type,lesson_position,is_preview,current_lesson_id=p_lesson_id,coalesce(completed_at is not null,false),case when current_lesson_id=p_lesson_id and current_lesson_type='text' then content else null end,case when current_lesson_id=p_lesson_id and current_lesson_type='video' then video_provider else null end,case when current_lesson_id=p_lesson_id and current_lesson_type='video' then video_reference else null end,case when current_lesson_id=p_lesson_id and current_lesson_type='video' then video_visibility else null end,case when current_lesson_id=p_lesson_id and current_lesson_type='video' then duration_seconds else null end,case when current_lesson_id=p_lesson_id then previous_id else null end,case when current_lesson_id=p_lesson_id then next_id else null end from ordered_lessons where exists (select 1 from ordered_lessons as target_row where target_row.current_lesson_id=p_lesson_id) order by module_position,module_id,lesson_position,current_lesson_id;
end; $$;

create or replace function public.complete_own_enrolled_lesson(p_course_id bigint, p_lesson_id bigint)
returns table (completed_lesson_id bigint, completed_at timestamptz, progress_percent integer)
language plpgsql security definer set search_path = ''
as $$
declare
  own_enrollment_id bigint;
  total_count integer;
  completed_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select enrollment_row.id
  into own_enrollment_id
  from public.enrollments as enrollment_row
  join public.learning_courses as course_row
    on course_row.id = enrollment_row.course_id
    and course_row.status = 'published'
  join public.lessons as lesson_row
    on lesson_row.id = p_lesson_id
    and lesson_row.course_id = course_row.id
    and lesson_row.lesson_type in ('text', 'video')
  where enrollment_row.learner_id = auth.uid()
    and enrollment_row.status in ('active', 'completed')
    and course_row.id = p_course_id
  for update of enrollment_row, course_row, lesson_row;

  if own_enrollment_id is null then
    raise exception 'This lesson is not available to this account' using errcode = '42501';
  end if;

  insert into public.lesson_progress (enrollment_id, lesson_id, completed_at, progress_percent)
  values (own_enrollment_id, p_lesson_id, now(), 100)
  on conflict (enrollment_id, lesson_id) do update
  set completed_at = coalesce(lesson_progress.completed_at, excluded.completed_at), progress_percent = 100;

  select count(lesson_row.id)::integer,
         count(lesson_row.id) filter (where progress_row.completed_at is not null and progress_row.progress_percent = 100)::integer
  into total_count, completed_count
  from public.lessons as lesson_row
  join public.course_modules as module_row
    on module_row.id = lesson_row.module_id and module_row.course_id = p_course_id
  left join public.lesson_progress as progress_row
    on progress_row.enrollment_id = own_enrollment_id and progress_row.lesson_id = lesson_row.id
  where lesson_row.course_id = p_course_id and lesson_row.lesson_type in ('text', 'video');

  if total_count > 0 and completed_count = total_count then
    update public.enrollments
    set status = 'completed', completed_at = coalesce(completed_at, now())
    where id = own_enrollment_id and status = 'active';
  end if;

  return query
  select progress_row.lesson_id, progress_row.completed_at, progress_row.progress_percent
  from public.lesson_progress as progress_row
  where progress_row.enrollment_id = own_enrollment_id and progress_row.lesson_id = p_lesson_id;
end;
$$;

revoke execute on function public.enroll_in_free_learning_course(bigint), public.get_own_learning_enrollment_state(bigint), public.get_own_enrolled_lesson_snapshot(text,bigint), public.complete_own_enrolled_lesson(bigint,bigint), public.list_own_learning_course_progress(integer,integer), public.get_own_enrolled_learning_course_progress_by_slug(text) from public, anon, authenticated;
grant execute on function public.enroll_in_free_learning_course(bigint), public.get_own_learning_enrollment_state(bigint), public.get_own_enrolled_lesson_snapshot(text,bigint), public.complete_own_enrolled_lesson(bigint,bigint), public.list_own_learning_course_progress(integer,integer), public.get_own_enrolled_learning_course_progress_by_slug(text) to authenticated;

do $$
declare function_name regprocedure;
begin
  foreach function_name in array array[
    'public.enroll_in_free_learning_course(bigint)'::regprocedure,
    'public.get_own_learning_enrollment_state(bigint)'::regprocedure,
    'public.get_own_enrolled_lesson_snapshot(text,bigint)'::regprocedure,
    'public.complete_own_enrolled_lesson(bigint,bigint)'::regprocedure,
    'public.list_own_learning_course_progress(integer,integer)'::regprocedure,
    'public.get_own_enrolled_learning_course_progress_by_slug(text)'::regprocedure
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
      raise exception 'Course progress aborted: RPC grants or security are not hardened for %', function_name;
    end if;
  end loop;
end;
$$;

commit;
