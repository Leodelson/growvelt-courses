-- Growvelt Learning: correct PL/pgSQL output-variable ambiguity in lesson completion.
-- Forward-only corrective migration for applied Phase 2B-D migration 014.

begin;

do $$
begin
  if to_regprocedure('public.complete_own_enrolled_lesson(bigint,bigint)') is null then
    raise exception 'Lesson completion correction aborted: expected Phase 2B-D function is missing';
  end if;
  if pg_get_function_result('public.complete_own_enrolled_lesson(bigint,bigint)'::regprocedure) <> 'TABLE(completed_lesson_id bigint, completed_at timestamp with time zone, progress_percent integer)' then
    raise exception 'Lesson completion correction aborted: unexpected completion return shape';
  end if;
  if not exists (
    select 1
    from pg_proc as procedure_row
    where procedure_row.oid = 'public.complete_own_enrolled_lesson(bigint,bigint)'::regprocedure
      and procedure_row.prosecdef
      and exists (
        select 1 from unnest(coalesce(procedure_row.proconfig, array[]::text[])) as setting_row(setting_value)
        where split_part(setting_row.setting_value, '=', 1) = 'search_path'
          and replace(split_part(setting_row.setting_value, '=', 2), '"', '') = ''
      )
  ) then
    raise exception 'Lesson completion correction aborted: expected SECURITY DEFINER empty-search-path baseline is missing';
  end if;
  if has_function_privilege('public', 'public.complete_own_enrolled_lesson(bigint,bigint)', 'EXECUTE')
    or has_function_privilege('anon', 'public.complete_own_enrolled_lesson(bigint,bigint)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.complete_own_enrolled_lesson(bigint,bigint)', 'EXECUTE') then
    raise exception 'Lesson completion correction aborted: expected execute grants are missing';
  end if;
end;
$$;

create or replace function public.complete_own_enrolled_lesson(p_course_id bigint, p_lesson_id bigint)
returns table (completed_lesson_id bigint, completed_at timestamptz, progress_percent integer)
language plpgsql security definer set search_path = ''
as $$
declare
  own_enrollment_id bigint;
  eligible_lesson_count integer;
  completed_eligible_lesson_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select enrollment_row.id
  into own_enrollment_id
  from public.enrollments as enrollment_row
  join public.learning_courses as course_row
    on course_row.id = enrollment_row.course_id and course_row.status = 'published'
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

  insert into public.lesson_progress as lesson_progress_row (enrollment_id, lesson_id, completed_at, progress_percent)
  values (own_enrollment_id, p_lesson_id, now(), 100)
  on conflict (enrollment_id, lesson_id) do update
  set completed_at = coalesce(lesson_progress_row.completed_at, excluded.completed_at),
      progress_percent = 100;

  select count(lesson_row.id)::integer,
         count(lesson_row.id) filter (where progress_row.completed_at is not null and progress_row.progress_percent = 100)::integer
  into eligible_lesson_count, completed_eligible_lesson_count
  from public.lessons as lesson_row
  join public.course_modules as module_row
    on module_row.id = lesson_row.module_id and module_row.course_id = p_course_id
  left join public.lesson_progress as progress_row
    on progress_row.enrollment_id = own_enrollment_id and progress_row.lesson_id = lesson_row.id
  where lesson_row.course_id = p_course_id and lesson_row.lesson_type in ('text', 'video');

  if eligible_lesson_count > 0 and completed_eligible_lesson_count = eligible_lesson_count then
    update public.enrollments as enrollment_row
    set status = 'completed',
        completed_at = coalesce(enrollment_row.completed_at, now())
    where enrollment_row.id = own_enrollment_id and enrollment_row.status = 'active';
  end if;

  return query
  select progress_row.lesson_id, progress_row.completed_at, progress_row.progress_percent
  from public.lesson_progress as progress_row
  where progress_row.enrollment_id = own_enrollment_id and progress_row.lesson_id = p_lesson_id;
end;
$$;

revoke execute on function public.complete_own_enrolled_lesson(bigint,bigint) from public, anon, authenticated;
grant execute on function public.complete_own_enrolled_lesson(bigint,bigint) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_proc as procedure_row
    where procedure_row.oid = 'public.complete_own_enrolled_lesson(bigint,bigint)'::regprocedure
      and procedure_row.prosecdef
      and exists (
        select 1 from unnest(coalesce(procedure_row.proconfig, array[]::text[])) as setting_row(setting_value)
        where split_part(setting_row.setting_value, '=', 1) = 'search_path'
          and replace(split_part(setting_row.setting_value, '=', 2), '"', '') = ''
      )
  ) or has_function_privilege('public', 'public.complete_own_enrolled_lesson(bigint,bigint)', 'EXECUTE')
    or has_function_privilege('anon', 'public.complete_own_enrolled_lesson(bigint,bigint)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.complete_own_enrolled_lesson(bigint,bigint)', 'EXECUTE') then
    raise exception 'Lesson completion correction aborted: corrected RPC is not hardened';
  end if;
end;
$$;

commit;
