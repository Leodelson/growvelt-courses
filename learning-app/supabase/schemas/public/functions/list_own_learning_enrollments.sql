create or replace function public.list_own_learning_enrollments (
  p_limit  integer default 24,
  p_offset integer default 0
)
  returns table (
    course_id       bigint,
    slug            text,
    title           text,
    summary         text,
    category        text,
    level           text,
    is_free         boolean,
    instructor_name text,
    enrolled_at     timestamp with time zone
  )
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_limit not between 1 and 36 or p_offset < 0 then raise exception 'Invalid enrollment pagination' using errcode = '22023'; end if;
  return query select course_row.id, course_row.slug, course_row.title, course_row.summary, course_row.category, course_row.level, course_row.is_free, profile_row.full_name, enrollment_row.enrolled_at
  from public.enrollments as enrollment_row
  join public.learning_courses as course_row on course_row.id = enrollment_row.course_id and course_row.status = 'published'
  left join public.profiles as profile_row on profile_row.id = course_row.instructor_id
  where enrollment_row.learner_id = auth.uid() and enrollment_row.status = 'active'
  order by enrollment_row.enrolled_at desc, enrollment_row.id desc limit p_limit offset p_offset;
end;
$function$;

grant execute on function "public"."list_own_learning_enrollments"(integer, integer) to "authenticated", "postgres", "service_role";

revoke all on function "public"."list_own_learning_enrollments"(integer, integer) from public;
