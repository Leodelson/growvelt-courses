create or replace function public.list_own_learning_course_experience (
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
    progress_percent  integer,
    resume_lesson_id  bigint
  )
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 48 or p_offset is null or p_offset < 0 then
    raise exception 'Invalid pagination' using errcode = '22023';
  end if;

  return query
  with own_enrollments as (
    select
      enrollment_row.id as source_enrollment_id,
      enrollment_row.course_id as source_course_id,
      enrollment_row.enrolled_at as source_enrolled_at,
      enrollment_row.status as source_enrollment_status
    from public.enrollments as enrollment_row
    where enrollment_row.learner_id = auth.uid()
      and enrollment_row.status in ('active', 'completed')
  ), activities as (
    select
      enrollment_row.source_enrollment_id,
      lesson_row.id as source_lesson_id,
      module_row.position as source_module_position,
      module_row.id as source_module_id,
      lesson_row.position as source_lesson_position,
      case
        when lesson_row.lesson_type in ('text', 'video') then coalesce(
          progress_row.completed_at is not null and progress_row.progress_percent = 100,
          false
        )
        when lesson_row.lesson_type = 'quiz' then exists (
          select 1
          from public.quiz_lessons as quiz_row
          join public.quiz_attempts as attempt_row on attempt_row.quiz_id = quiz_row.id
          where quiz_row.lesson_id = lesson_row.id
            and attempt_row.enrollment_id = enrollment_row.source_enrollment_id
            and attempt_row.passed
        )
        else false
      end as source_is_complete
    from own_enrollments as enrollment_row
    join public.course_modules as module_row on module_row.course_id = enrollment_row.source_course_id
    join public.lessons as lesson_row
      on lesson_row.course_id = enrollment_row.source_course_id
      and lesson_row.module_id = module_row.id
      and lesson_row.lesson_type in ('text', 'video', 'quiz')
    left join public.lesson_progress as progress_row
      on progress_row.enrollment_id = enrollment_row.source_enrollment_id
      and progress_row.lesson_id = lesson_row.id
  ), totals as (
    select
      activity_row.source_enrollment_id,
      count(*)::integer as source_total_lessons,
      count(*) filter (where activity_row.source_is_complete)::integer as source_completed_lessons
    from activities as activity_row
    group by activity_row.source_enrollment_id
  ), resume as (
    select distinct on (activity_row.source_enrollment_id)
      activity_row.source_enrollment_id,
      activity_row.source_lesson_id
    from activities as activity_row
    where not activity_row.source_is_complete
    order by
      activity_row.source_enrollment_id,
      activity_row.source_module_position,
      activity_row.source_module_id,
      activity_row.source_lesson_position,
      activity_row.source_lesson_id
  )
  select
    course_row.id,
    course_row.slug,
    course_row.title,
    course_row.summary,
    course_row.category,
    course_row.level,
    course_row.is_free,
    profile_row.full_name,
    enrollment_row.source_enrolled_at,
    enrollment_row.source_enrollment_status,
    coalesce(totals.source_completed_lessons, 0),
    coalesce(totals.source_total_lessons, 0),
    case
      when coalesce(totals.source_total_lessons, 0) = 0 then 0
      else least(100, (coalesce(totals.source_completed_lessons, 0) * 100) / totals.source_total_lessons)
    end,
    resume.source_lesson_id
  from own_enrollments as enrollment_row
  join public.learning_courses as course_row
    on course_row.id = enrollment_row.source_course_id
    and course_row.status = 'published'
  left join public.profiles as profile_row on profile_row.id = course_row.instructor_id
  left join totals on totals.source_enrollment_id = enrollment_row.source_enrollment_id
  left join resume on resume.source_enrollment_id = enrollment_row.source_enrollment_id
  order by enrollment_row.source_enrolled_at desc, course_row.id desc
  limit p_limit
  offset p_offset;
end;
$function$;

grant execute on function "public"."list_own_learning_course_experience"(integer, integer) to "authenticated", "postgres", "service_role";

revoke all on function "public"."list_own_learning_course_experience"(integer, integer) from public;
