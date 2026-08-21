create or replace function public.get_own_enrolled_learning_course_experience_by_slug (
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
    resume_lesson_id        bigint,
    module_id               bigint,
    module_title            text,
    module_position         integer,
    lesson_id               bigint,
    lesson_title            text,
    lesson_type             text,
    lesson_completed        boolean,
    is_preview              boolean
  )
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
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
    select
      enrollment_row.id as source_enrollment_id,
      enrollment_row.enrolled_at as source_enrolled_at,
      enrollment_row.status as source_enrollment_status,
      enrollment_row.completed_at as source_enrollment_completed_at,
      course_row.id as source_course_id,
      course_row.slug as source_course_slug,
      course_row.title as source_course_title,
      course_row.summary as source_summary,
      course_row.description as source_description,
      course_row.category as source_category,
      course_row.level as source_level,
      course_row.is_free as source_is_free,
      profile_row.full_name as source_instructor_name
    from public.enrollments as enrollment_row
    join public.learning_courses as course_row
      on course_row.id = enrollment_row.course_id
      and course_row.status = 'published'
    left join public.profiles as profile_row on profile_row.id = course_row.instructor_id
    where enrollment_row.learner_id = auth.uid()
      and enrollment_row.status in ('active', 'completed')
      and course_row.slug = normalized_slug
  ), course_rows as (
    select
      enrolled_course.source_enrollment_id,
      lesson_row.id as source_lesson_id,
      lesson_row.lesson_type as source_lesson_type,
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
            and attempt_row.enrollment_id = enrolled_course.source_enrollment_id
            and attempt_row.passed
        )
        else false
      end as source_is_complete
    from enrolled_course
    join public.course_modules as module_row on module_row.course_id = enrolled_course.source_course_id
    join public.lessons as lesson_row
      on lesson_row.course_id = enrolled_course.source_course_id
      and lesson_row.module_id = module_row.id
    left join public.lesson_progress as progress_row
      on progress_row.enrollment_id = enrolled_course.source_enrollment_id
      and progress_row.lesson_id = lesson_row.id
  ), totals as (
    select
      course_row.source_enrollment_id,
      count(*) filter (where course_row.source_lesson_type in ('text', 'video', 'quiz'))::integer as source_total_lessons,
      count(*) filter (
        where course_row.source_lesson_type in ('text', 'video', 'quiz')
          and course_row.source_is_complete
      )::integer as source_completed_lessons
    from course_rows as course_row
    group by course_row.source_enrollment_id
  ), resume as (
    select distinct on (course_row.source_enrollment_id)
      course_row.source_enrollment_id,
      course_row.source_lesson_id
    from course_rows as course_row
    where course_row.source_lesson_type in ('text', 'video', 'quiz')
      and not course_row.source_is_complete
    order by
      course_row.source_enrollment_id,
      course_row.source_module_position,
      course_row.source_module_id,
      course_row.source_lesson_position,
      course_row.source_lesson_id
  )
  select
    enrolled_course.source_course_id,
    enrolled_course.source_course_slug,
    enrolled_course.source_course_title,
    enrolled_course.source_summary,
    enrolled_course.source_description,
    enrolled_course.source_category,
    enrolled_course.source_level,
    enrolled_course.source_is_free,
    enrolled_course.source_instructor_name,
    enrolled_course.source_enrolled_at,
    enrolled_course.source_enrollment_status,
    enrolled_course.source_enrollment_completed_at,
    coalesce(totals.source_completed_lessons, 0),
    coalesce(totals.source_total_lessons, 0),
    case
      when coalesce(totals.source_total_lessons, 0) = 0 then 0
      else least(100, (coalesce(totals.source_completed_lessons, 0) * 100) / totals.source_total_lessons)
    end,
    resume.source_lesson_id,
    module_row.id,
    module_row.title,
    module_row.position,
    lesson_row.id,
    lesson_row.title,
    lesson_row.lesson_type,
    coalesce(course_row.source_is_complete, false),
    lesson_row.is_preview
  from enrolled_course
  left join totals on totals.source_enrollment_id = enrolled_course.source_enrollment_id
  left join resume on resume.source_enrollment_id = enrolled_course.source_enrollment_id
  left join public.course_modules as module_row on module_row.course_id = enrolled_course.source_course_id
  left join public.lessons as lesson_row
    on lesson_row.course_id = enrolled_course.source_course_id
    and lesson_row.module_id = module_row.id
  left join course_rows as course_row
    on course_row.source_enrollment_id = enrolled_course.source_enrollment_id
    and course_row.source_lesson_id = lesson_row.id
  order by module_row.position, module_row.id, lesson_row.position, lesson_row.id;
end;
$function$;

grant execute on function "public"."get_own_enrolled_learning_course_experience_by_slug"(text) to "authenticated", "postgres", "service_role";

revoke all on function "public"."get_own_enrolled_learning_course_experience_by_slug"(text) from public;
