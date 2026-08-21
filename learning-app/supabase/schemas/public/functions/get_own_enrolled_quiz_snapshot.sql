create or replace function public.get_own_enrolled_quiz_snapshot (
  p_slug      text,
  p_lesson_id bigint
)
  returns table (
    course_id                       bigint,
    course_slug                     text,
    lesson_id                       bigint,
    lesson_title                    text,
    quiz_id                         bigint,
    instructions                    text,
    passing_percentage              integer,
    question_id                     bigint,
    question_text                   text,
    question_position               integer,
    option_id                       bigint,
    option_text                     text,
    option_position                 integer,
    latest_attempt_submitted_at     timestamp with time zone,
    latest_attempt_score_percentage integer,
    latest_attempt_passed           boolean,
    attempt_count                   integer
  )
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare normalized_slug text := lower(btrim(p_slug));
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if normalized_slug is null or normalized_slug = '' or char_length(normalized_slug) > 220 then
    raise exception 'Invalid course reference' using errcode = '22023';
  end if;
  return query
  with enrolled_quiz as (
    select course_row.id as source_course_id,
           course_row.slug as source_course_slug,
           lesson_row.id as source_lesson_id,
           lesson_row.title as source_lesson_title,
           quiz_row.id as source_quiz_id,
           quiz_row.instructions as source_instructions,
           quiz_row.passing_percentage as source_passing_percentage,
           enrollment_row.id as source_enrollment_id
    from public.enrollments as enrollment_row
    join public.learning_courses as course_row
      on course_row.id = enrollment_row.course_id
     and course_row.status = 'published'
    join public.lessons as lesson_row
      on lesson_row.id = p_lesson_id
     and lesson_row.course_id = course_row.id
     and lesson_row.lesson_type = 'quiz'
    join public.quiz_lessons as quiz_row on quiz_row.lesson_id = lesson_row.id
    where enrollment_row.learner_id = auth.uid()
      and enrollment_row.status in ('active', 'completed')
      and course_row.slug = normalized_slug
  ), attempt_summary as (
    select attempt_row.submitted_at,
           attempt_row.score_percentage,
           attempt_row.passed,
      row_number() over (order by attempt_row.submitted_at desc, attempt_row.id desc) as attempt_rank,
      count(*) over ()::integer as attempt_count
    from enrolled_quiz
    join public.quiz_attempts as attempt_row
      on attempt_row.quiz_id = enrolled_quiz.source_quiz_id
     and attempt_row.enrollment_id = enrolled_quiz.source_enrollment_id
     and attempt_row.learner_id = auth.uid()
  )
  select enrolled_quiz.source_course_id,
         enrolled_quiz.source_course_slug,
         enrolled_quiz.source_lesson_id,
         enrolled_quiz.source_lesson_title,
         enrolled_quiz.source_quiz_id,
         enrolled_quiz.source_instructions,
         enrolled_quiz.source_passing_percentage,
         question_row.id,
         question_row.question_text,
         question_row.position,
         option_row.id,
         option_row.option_text,
         option_row.position,
         latest_attempt.submitted_at,
         latest_attempt.score_percentage,
         latest_attempt.passed,
         coalesce(latest_attempt.attempt_count, 0)
  from enrolled_quiz
  join public.quiz_questions as question_row on question_row.quiz_id = enrolled_quiz.source_quiz_id
  join public.quiz_options as option_row on option_row.question_id = question_row.id
  left join attempt_summary as latest_attempt on latest_attempt.attempt_rank = 1
  order by question_row.position, question_row.id, option_row.position, option_row.id;
end;
$function$;

grant execute on function "public"."get_own_enrolled_quiz_snapshot"(text, bigint) to "authenticated", "postgres", "service_role";

revoke all on function "public"."get_own_enrolled_quiz_snapshot"(text, bigint) from public;
