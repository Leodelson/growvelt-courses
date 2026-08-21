create or replace function public.enroll_in_free_learning_course (
  p_course_id bigint
)
  returns table (
    enrollment_id     bigint,
    enrollment_status text
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
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
$function$;

grant execute on function "public"."enroll_in_free_learning_course"(bigint) to "authenticated", "postgres", "service_role";

revoke all on function "public"."enroll_in_free_learning_course"(bigint) from public;
