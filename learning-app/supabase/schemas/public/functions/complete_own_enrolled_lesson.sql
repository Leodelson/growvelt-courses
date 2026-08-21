create or replace function public.complete_own_enrolled_lesson (
  p_course_id bigint,
  p_lesson_id bigint
)
  returns table (
    completed_lesson_id bigint,
    completed_at        timestamp with time zone,
    progress_percent    integer
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare own_enrollment_id bigint; completion_time timestamptz; completion_percent integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select enrollment_row.id into own_enrollment_id
  from public.enrollments as enrollment_row
  join public.learning_courses as course_row on course_row.id = enrollment_row.course_id and course_row.status = 'published'
  join public.lessons as lesson_row on lesson_row.id = p_lesson_id and lesson_row.course_id = course_row.id and lesson_row.lesson_type in ('text', 'video')
  where enrollment_row.learner_id = auth.uid() and enrollment_row.status in ('active', 'completed') and course_row.id = p_course_id
  for update of enrollment_row, course_row, lesson_row;
  if own_enrollment_id is null then raise exception 'This lesson is not available to this account' using errcode = '42501';end if;
  insert into public.lesson_progress as progress_row (enrollment_id, lesson_id, completed_at, progress_percent)
  values (own_enrollment_id, p_lesson_id, now(), 100)
  on conflict (enrollment_id, lesson_id) do update set completed_at = coalesce(progress_row.completed_at, excluded.completed_at), progress_percent = 100
  returning progress_row.completed_at into completion_time;
  perform public.recompute_learning_enrollment_completion(own_enrollment_id);
  completion_percent := 100;
  return query select p_lesson_id, completion_time, completion_percent;
end;
$function$;

grant execute on function "public"."complete_own_enrolled_lesson"(bigint, bigint) to "authenticated", "postgres", "service_role";

revoke all on function "public"."complete_own_enrolled_lesson"(bigint, bigint) from public;
