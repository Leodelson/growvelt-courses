create or replace function public.get_own_instructor_learning_analytics()
  returns table (
    course_id                 bigint,
    course_title              text,
    course_status             text,
    enrolled_learner_count    integer,
    active_learner_count      integer,
    completed_learner_count   integer,
    completion_rate           integer,
    quiz_count                integer,
    quiz_attempt_count        integer,
    quiz_passed_attempt_count integer,
    quiz_attempt_pass_rate    integer,
    average_quiz_score        integer,
    last_enrolled_at          timestamp with time zone
  )
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;

  return query
  with own_courses as (
    select
      course_row.id as source_course_id,
      course_row.title as source_course_title,
      course_row.status as source_course_status
    from public.learning_courses as course_row
    where course_row.instructor_id = auth.uid()
  ),
  enrollment_metrics as (
    select
      enrollment_row.course_id as source_course_id,
      count(*) filter (where enrollment_row.status in ('active', 'completed'))::integer as source_enrolled_learner_count,
      count(*) filter (where enrollment_row.status = 'active')::integer as source_active_learner_count,
      count(*) filter (where enrollment_row.status = 'completed')::integer as source_completed_learner_count,
      max(enrollment_row.enrolled_at) filter (where enrollment_row.status in ('active', 'completed')) as source_last_enrolled_at
    from public.enrollments as enrollment_row
    join own_courses as course_row
      on course_row.source_course_id = enrollment_row.course_id
    group by enrollment_row.course_id
  ),
  quiz_metrics as (
    select
      attempt_row.course_id as source_course_id,
      count(*)::integer as source_quiz_attempt_count,
      count(*) filter (where attempt_row.passed)::integer as source_quiz_passed_attempt_count,
      coalesce(round(avg(attempt_row.score_percentage))::integer, 0) as source_average_quiz_score
    from public.quiz_attempts as attempt_row
    join own_courses as course_row
      on course_row.source_course_id = attempt_row.course_id
    group by attempt_row.course_id
  ),
  quiz_totals as (
    select
      quiz_row.course_id as source_course_id,
      count(*)::integer as source_quiz_count
    from public.quiz_lessons as quiz_row
    join own_courses as course_row
      on course_row.source_course_id = quiz_row.course_id
    group by quiz_row.course_id
  )
  select
    course_row.source_course_id,
    course_row.source_course_title,
    course_row.source_course_status,
    coalesce(enrollment_row.source_enrolled_learner_count, 0),
    coalesce(enrollment_row.source_active_learner_count, 0),
    coalesce(enrollment_row.source_completed_learner_count, 0),
    case
      when coalesce(enrollment_row.source_enrolled_learner_count, 0) = 0 then 0
      else round(
        (coalesce(enrollment_row.source_completed_learner_count, 0)::numeric
          / enrollment_row.source_enrolled_learner_count::numeric) * 100
      )::integer
    end,
    coalesce(quiz_total_row.source_quiz_count, 0),
    coalesce(quiz_row.source_quiz_attempt_count, 0),
    coalesce(quiz_row.source_quiz_passed_attempt_count, 0),
    case
      when coalesce(quiz_row.source_quiz_attempt_count, 0) = 0 then 0
      else round(
        (quiz_row.source_quiz_passed_attempt_count::numeric
          / quiz_row.source_quiz_attempt_count::numeric) * 100
      )::integer
    end,
    coalesce(quiz_row.source_average_quiz_score, 0),
    enrollment_row.source_last_enrolled_at
  from own_courses as course_row
  left join enrollment_metrics as enrollment_row
    on enrollment_row.source_course_id = course_row.source_course_id
  left join quiz_metrics as quiz_row
    on quiz_row.source_course_id = course_row.source_course_id
  left join quiz_totals as quiz_total_row
    on quiz_total_row.source_course_id = course_row.source_course_id
  order by course_row.source_course_title asc, course_row.source_course_id asc;
end;
$function$;

grant execute on function "public"."get_own_instructor_learning_analytics"() to "authenticated", "postgres", "service_role";

revoke all on function "public"."get_own_instructor_learning_analytics"() from public;
