create or replace function public.list_own_learning_course_progress (
  p_limit  integer default 24,
  p_offset integer default 0
)
  returns table (
    course_id         bigint,
    slug              text,
    title             text,
    summary           text,
    category          text,
    level             text,
    is_free           boolean,
    instructor_name   text,
    enrolled_at       timestamp with time zone,
    enrollment_status text,
    completed_lessons integer,
    total_lessons     integer,
    progress_percent  integer
  )
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
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
$function$;

grant execute on function "public"."list_own_learning_course_progress"(integer, integer) to "authenticated", "postgres", "service_role";

revoke all on function "public"."list_own_learning_course_progress"(integer, integer) from public;
