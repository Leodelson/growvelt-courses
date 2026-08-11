-- Growvelt Learning: correct PL/pgSQL output-variable ambiguity in the lesson snapshot.
-- Forward-only corrective migration for applied Phase 2B-D migration 014.

begin;

do $$
begin
  if to_regprocedure('public.get_own_enrolled_lesson_snapshot(text,bigint)') is null then
    raise exception 'Lesson snapshot correction aborted: expected Phase 2B-D function is missing';
  end if;
  if not exists (
    select 1
    from pg_proc as procedure_row
    where procedure_row.oid = 'public.get_own_enrolled_lesson_snapshot(text,bigint)'::regprocedure
      and procedure_row.prosecdef
      and exists (
        select 1
        from unnest(coalesce(procedure_row.proconfig, array[]::text[])) as setting_row(setting_value)
        where split_part(setting_row.setting_value, '=', 1) = 'search_path'
          and replace(split_part(setting_row.setting_value, '=', 2), '"', '') = ''
      )
  ) then
    raise exception 'Lesson snapshot correction aborted: expected SECURITY DEFINER empty-search-path baseline is missing';
  end if;
  if pg_get_function_result('public.get_own_enrolled_lesson_snapshot(text,bigint)'::regprocedure) not like '%course_id bigint%current_text_content text%next_lesson_id bigint%' then
    raise exception 'Lesson snapshot correction aborted: unexpected snapshot return shape';
  end if;
  if has_function_privilege('public', 'public.get_own_enrolled_lesson_snapshot(text,bigint)', 'EXECUTE')
    or has_function_privilege('anon', 'public.get_own_enrolled_lesson_snapshot(text,bigint)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.get_own_enrolled_lesson_snapshot(text,bigint)', 'EXECUTE') then
    raise exception 'Lesson snapshot correction aborted: expected execute grants are missing';
  end if;
end;
$$;

create or replace function public.get_own_enrolled_lesson_snapshot(p_slug text, p_lesson_id bigint)
returns table (course_id bigint, course_slug text, course_title text, enrollment_id bigint, module_id bigint, module_title text, module_position integer, lesson_id bigint, lesson_title text, lesson_type text, lesson_position integer, is_preview boolean, is_current boolean, is_completed boolean, current_text_content text, current_video_provider text, current_video_reference text, current_video_visibility text, current_duration_seconds integer, previous_lesson_id bigint, next_lesson_id bigint)
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
    select course_row.id, course_row.slug, course_row.title, enrollment_row.id as own_enrollment_id
    from public.enrollments as enrollment_row
    join public.learning_courses as course_row
      on course_row.id = enrollment_row.course_id and course_row.status = 'published'
    where enrollment_row.learner_id = auth.uid()
      and enrollment_row.status in ('active', 'completed')
      and course_row.slug = normalized_slug
  ), ordered_lessons as (
    select enrolled_course.id as source_course_id, enrolled_course.slug as source_course_slug, enrolled_course.title as source_course_title, enrolled_course.own_enrollment_id as source_enrollment_id,
      module_row.id as source_module_id, module_row.title as source_module_title, module_row.position as source_module_position,
      lesson_row.id as source_lesson_id, lesson_row.title as source_lesson_title, lesson_row.lesson_type as source_lesson_type, lesson_row.position as source_lesson_position, lesson_row.is_preview as source_is_preview,
      lesson_row.content as source_content, lesson_row.video_provider as source_video_provider, lesson_row.video_reference as source_video_reference, lesson_row.video_visibility as source_video_visibility, lesson_row.duration_seconds as source_duration_seconds,
      progress_row.completed_at as source_completed_at,
      lag(lesson_row.id) over (order by module_row.position, module_row.id, lesson_row.position, lesson_row.id) as source_previous_lesson_id,
      lead(lesson_row.id) over (order by module_row.position, module_row.id, lesson_row.position, lesson_row.id) as source_next_lesson_id
    from enrolled_course
    join public.course_modules as module_row on module_row.course_id = enrolled_course.id
    join public.lessons as lesson_row on lesson_row.course_id = enrolled_course.id and lesson_row.module_id = module_row.id
    left join public.lesson_progress as progress_row on progress_row.enrollment_id = enrolled_course.own_enrollment_id and progress_row.lesson_id = lesson_row.id
  )
  select
    ordered_lessons.source_course_id,
    ordered_lessons.source_course_slug,
    ordered_lessons.source_course_title,
    ordered_lessons.source_enrollment_id,
    ordered_lessons.source_module_id,
    ordered_lessons.source_module_title,
    ordered_lessons.source_module_position,
    ordered_lessons.source_lesson_id,
    ordered_lessons.source_lesson_title,
    ordered_lessons.source_lesson_type,
    ordered_lessons.source_lesson_position,
    ordered_lessons.source_is_preview,
    ordered_lessons.source_lesson_id = p_lesson_id,
    coalesce(ordered_lessons.source_completed_at is not null, false),
    case when ordered_lessons.source_lesson_id = p_lesson_id and ordered_lessons.source_lesson_type = 'text' then ordered_lessons.source_content else null end,
    case when ordered_lessons.source_lesson_id = p_lesson_id and ordered_lessons.source_lesson_type = 'video' then ordered_lessons.source_video_provider else null end,
    case when ordered_lessons.source_lesson_id = p_lesson_id and ordered_lessons.source_lesson_type = 'video' then ordered_lessons.source_video_reference else null end,
    case when ordered_lessons.source_lesson_id = p_lesson_id and ordered_lessons.source_lesson_type = 'video' then ordered_lessons.source_video_visibility else null end,
    case when ordered_lessons.source_lesson_id = p_lesson_id and ordered_lessons.source_lesson_type = 'video' then ordered_lessons.source_duration_seconds else null end,
    case when ordered_lessons.source_lesson_id = p_lesson_id then ordered_lessons.source_previous_lesson_id else null end,
    case when ordered_lessons.source_lesson_id = p_lesson_id then ordered_lessons.source_next_lesson_id else null end
  from ordered_lessons
  where exists (select 1 from ordered_lessons as target_row where target_row.source_lesson_id = p_lesson_id)
  order by ordered_lessons.source_module_position, ordered_lessons.source_module_id, ordered_lessons.source_lesson_position, ordered_lessons.source_lesson_id;
end;
$$;

revoke execute on function public.get_own_enrolled_lesson_snapshot(text,bigint) from public, anon, authenticated;
grant execute on function public.get_own_enrolled_lesson_snapshot(text,bigint) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_proc as procedure_row
    where procedure_row.oid = 'public.get_own_enrolled_lesson_snapshot(text,bigint)'::regprocedure
      and procedure_row.prosecdef
      and exists (
        select 1 from unnest(coalesce(procedure_row.proconfig, array[]::text[])) as setting_row(setting_value)
        where split_part(setting_row.setting_value, '=', 1) = 'search_path'
          and replace(split_part(setting_row.setting_value, '=', 2), '"', '') = ''
      )
  ) or has_function_privilege('public', 'public.get_own_enrolled_lesson_snapshot(text,bigint)', 'EXECUTE')
    or has_function_privilege('anon', 'public.get_own_enrolled_lesson_snapshot(text,bigint)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.get_own_enrolled_lesson_snapshot(text,bigint)', 'EXECUTE') then
    raise exception 'Lesson snapshot correction aborted: corrected RPC is not hardened';
  end if;
end;
$$;

commit;
