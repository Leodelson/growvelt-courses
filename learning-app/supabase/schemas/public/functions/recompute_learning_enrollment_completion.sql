create or replace function public.recompute_learning_enrollment_completion (
  p_enrollment_id bigint
)
  returns table (
    completed_lessons       integer,
    total_lessons           integer,
    progress_percent        integer,
    enrollment_status       text,
    enrollment_completed_at timestamp with time zone
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  course_key bigint;
  current_status text;
  total_count integer;
  done_count integer;
begin
  select enrollment_row.course_id, enrollment_row.status
  into course_key, current_status
  from public.enrollments as enrollment_row
  where enrollment_row.id = p_enrollment_id
  for update;
  if course_key is null or current_status = 'cancelled' then
    raise exception 'Enrollment is not active' using errcode = '42501';
  end if;

  with activities as (
    select lesson_row.id,
      case
        when lesson_row.lesson_type in ('text', 'video') then coalesce(progress_row.completed_at is not null and progress_row.progress_percent = 100, false)
        when lesson_row.lesson_type = 'quiz' then exists (
          select 1 from public.quiz_lessons as quiz_row
          join public.quiz_attempts as attempt_row on attempt_row.quiz_id = quiz_row.id
          where quiz_row.lesson_id = lesson_row.id
            and attempt_row.enrollment_id = p_enrollment_id
            and attempt_row.passed = true
        )
        else false
      end as is_complete
    from public.course_modules as module_row
    join public.lessons as lesson_row on lesson_row.course_id = module_row.course_id and lesson_row.module_id = module_row.id
    left join public.lesson_progress as progress_row on progress_row.enrollment_id = p_enrollment_id and progress_row.lesson_id = lesson_row.id
    where module_row.course_id = course_key
      and lesson_row.lesson_type in ('text', 'video', 'quiz')
  )
  select count(*)::integer, count(*) filter (where activities.is_complete)::integer
  into total_count, done_count
  from activities;

  if total_count > 0 and done_count = total_count and current_status = 'active' then
    update public.enrollments as enrollment_row
    set status = 'completed', completed_at = coalesce(enrollment_row.completed_at, now())
    where enrollment_row.id = p_enrollment_id and enrollment_row.status = 'active';
  end if;

  return query
  select done_count,
         total_count,
         case when total_count = 0 then 0 else least(100, (done_count * 100) / total_count) end,
         enrollment_row.status,
         enrollment_row.completed_at
  from public.enrollments as enrollment_row
  where enrollment_row.id = p_enrollment_id;
end;
$function$;

grant execute on function "public"."recompute_learning_enrollment_completion"(bigint) to "postgres", "service_role";

revoke all on function "public"."recompute_learning_enrollment_completion"(bigint) from public;
