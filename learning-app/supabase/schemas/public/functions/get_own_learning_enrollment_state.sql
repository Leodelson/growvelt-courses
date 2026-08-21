create or replace function public.get_own_learning_enrollment_state (
  p_course_id bigint
)
  returns table (
    is_enrolled       boolean,
    enrollment_status text,
    enrolled_at       timestamp with time zone
  )
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  return query select true, enrollment_row.status, enrollment_row.enrolled_at
  from public.enrollments as enrollment_row
  join public.learning_courses as course_row on course_row.id = enrollment_row.course_id and course_row.status = 'published'
  where enrollment_row.learner_id = auth.uid() and enrollment_row.course_id = p_course_id and enrollment_row.status in ('active', 'completed');
  if not found then return query select false, null::text, null::timestamptz; end if;
end;
$function$;

grant execute on function "public"."get_own_learning_enrollment_state"(bigint) to "authenticated", "postgres", "service_role";

revoke all on function "public"."get_own_learning_enrollment_state"(bigint) from public;
