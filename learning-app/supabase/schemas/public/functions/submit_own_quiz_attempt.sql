create or replace function public.submit_own_quiz_attempt (
  p_slug      text,
  p_lesson_id bigint,
  p_answers   jsonb
)
  returns table (
    attempt_id           bigint,
    submitted_at         timestamp with time zone,
    score_percentage     integer,
    passed               boolean,
    correct_answer_count integer,
    total_question_count integer
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  normalized_slug text := lower(btrim(p_slug));
  own_enrollment_id bigint;
  own_course_id bigint;
  quiz_key bigint;
  passing_mark integer;
  question_total integer;
  submitted_total integer;
  distinct_questions integer;
  correct_total integer;
  calculated_score integer;
  created_attempt_id bigint;
  created_submitted_at timestamptz;
  calculated_passed boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if normalized_slug is null or normalized_slug = '' or char_length(normalized_slug) > 220 then
    raise exception 'Invalid course reference' using errcode = '22023';
  end if;
  if jsonb_typeof(p_answers) <> 'array' then
    raise exception 'Quiz answers must be an array' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_answers) as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or (item.value ->> 'question_id') !~ '^[1-9][0-9]*$'
      or (item.value ->> 'option_id') !~ '^[1-9][0-9]*$'
  ) then
    raise exception 'Quiz answer identifiers must be positive integers' using errcode = '22023';
  end if;

  select enrollment_row.id, course_row.id, quiz_row.id, quiz_row.passing_percentage
  into own_enrollment_id, own_course_id, quiz_key, passing_mark
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
  for update of enrollment_row, course_row, lesson_row, quiz_row;

  if own_enrollment_id is null then
    raise exception 'This quiz is not available to this account' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.quiz_questions as question_row
    left join public.quiz_options as option_row on option_row.question_id = question_row.id
    where question_row.quiz_id = quiz_key
    group by question_row.id
    having count(option_row.id) not between 2 and 6
      or count(option_row.id) filter (where option_row.is_correct) <> 1
  ) or not exists (
    select 1
    from public.quiz_questions as question_row
    where question_row.quiz_id = quiz_key
  ) or passing_mark not between 1 and 100 then
    raise exception 'Quiz configuration is incomplete' using errcode = '22023';
  end if;

  with submitted_answers as (
    select
      (item.value ->> 'question_id')::bigint as question_id,
      (item.value ->> 'option_id')::bigint as option_id
    from jsonb_array_elements(p_answers) as item(value)
  )
  select count(*)::integer, count(distinct submitted_answers.question_id)::integer
  into submitted_total, distinct_questions
  from submitted_answers;

  select count(*)::integer into question_total
  from public.quiz_questions as question_row
  where question_row.quiz_id = quiz_key;

  if question_total < 1 or submitted_total <> question_total or distinct_questions <> question_total then
    raise exception 'Answer every quiz question exactly once' using errcode = '22023';
  end if;

  if exists (
    with submitted_answers as (
      select
        (item.value ->> 'question_id')::bigint as question_id,
        (item.value ->> 'option_id')::bigint as option_id
      from jsonb_array_elements(p_answers) as item(value)
    )
    select 1
    from submitted_answers
    left join public.quiz_questions as question_row
      on question_row.id = submitted_answers.question_id
      and question_row.quiz_id = quiz_key
    left join public.quiz_options as option_row
      on option_row.id = submitted_answers.option_id
      and option_row.question_id = question_row.id
    where question_row.id is null or option_row.id is null
  ) then
    raise exception 'Quiz answers do not match this assessment' using errcode = '22023';
  end if;

  with submitted_answers as (
    select
      (item.value ->> 'question_id')::bigint as question_id,
      (item.value ->> 'option_id')::bigint as option_id
    from jsonb_array_elements(p_answers) as item(value)
  )
  select count(*) filter (where option_row.is_correct)::integer
  into correct_total
  from submitted_answers
  join public.quiz_options as option_row
    on option_row.id = submitted_answers.option_id
    and option_row.question_id = submitted_answers.question_id;

  calculated_score := floor((correct_total::numeric * 100) / question_total)::integer;
  calculated_passed := calculated_score >= passing_mark;

  insert into public.quiz_attempts as attempt_row (
    quiz_id,
    enrollment_id,
    learner_id,
    course_id,
    correct_answer_count,
    total_question_count,
    score_percentage,
    passed
  ) values (
    quiz_key,
    own_enrollment_id,
    auth.uid(),
    own_course_id,
    correct_total,
    question_total,
    calculated_score,
    calculated_passed
  )
  returning attempt_row.id, attempt_row.submitted_at
  into created_attempt_id, created_submitted_at;

  insert into public.quiz_attempt_answers (
    attempt_id,
    quiz_id,
    question_id,
    selected_option_id
  )
  select
    created_attempt_id,
    quiz_key,
    (item.value ->> 'question_id')::bigint,
    (item.value ->> 'option_id')::bigint
  from jsonb_array_elements(p_answers) as item(value);

  perform public.recompute_learning_enrollment_completion(own_enrollment_id);

  return query
  select
    created_attempt_id,
    created_submitted_at,
    calculated_score,
    calculated_passed,
    correct_total,
    question_total;
end;
$function$;

grant execute on function "public"."submit_own_quiz_attempt"(text, bigint, jsonb) to "authenticated", "postgres", "service_role";

revoke all on function "public"."submit_own_quiz_attempt"(text, bigint, jsonb) from public;
