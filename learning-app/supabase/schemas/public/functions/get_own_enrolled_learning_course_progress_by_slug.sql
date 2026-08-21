create or replace function public.get_own_enrolled_learning_course_progress_by_slug (
  p_slug text
)
  returns table (
    course_id               bigint,
    slug                    text,
    course_title            text,
    summary                 text,
    description             text,
    category                text,
    level                   text,
    is_free                 boolean,
    instructor_name         text,
    enrolled_at             timestamp with time zone,
    enrollment_status       text,
    enrollment_completed_at timestamp with time zone,
    completed_lessons       integer,
    total_lessons           integer,
    progress_percent        integer,
    module_id               bigint,
    module_title            text,
    module_position         integer,
    lesson_id               bigint,
    lesson_title            text,
    lesson_type             text,
    is_preview              boolean
  )
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
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
$function$;

grant execute on function "public"."get_own_enrolled_learning_course_progress_by_slug"(text) to "authenticated", "postgres", "service_role";

revoke all on function "public"."get_own_enrolled_learning_course_progress_by_slug"(text) from public;
