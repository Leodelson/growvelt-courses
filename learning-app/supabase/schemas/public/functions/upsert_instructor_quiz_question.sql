create or replace function public.upsert_instructor_quiz_question (
  p_lesson_id     bigint,
  p_question_id   bigint default null::bigint,
  p_question_text text   default null::text,
  p_options       jsonb  default '[]'::jsonb
)
  returns table (
    question_id       bigint,
    question_position integer
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  course_key bigint;
  quiz_key bigint;
  question_key bigint;
  next_position integer;
  normalized_question text := btrim(p_question_text);
  option_total integer;
  correct_total integer;
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;
  if normalized_question is null or char_length(normalized_question) not between 2 and 2000 then
    raise exception 'Quiz question must be between 2 and 2000 characters' using errcode = '22023';
  end if;
  if jsonb_typeof(p_options) <> 'array' then
    raise exception 'Quiz options must be an array' using errcode = '22023';
  end if;

  with option_rows as (
    select answer_item.value
    from jsonb_array_elements(p_options) as answer_item(value)
  )
  select count(*)::integer,
    count(*) filter (
      where case
        when jsonb_typeof(option_rows.value -> 'is_correct') = 'boolean'
          then (option_rows.value ->> 'is_correct')::boolean
        else false
      end
    )::integer
  into option_total, correct_total
  from option_rows;
  if option_total not between 2 and 6 or correct_total <> 1 then
    raise exception 'Each question needs 2 to 6 options and exactly one correct option' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_options) as answer_item(value)
    where jsonb_typeof(answer_item.value) <> 'object'
      or jsonb_typeof(answer_item.value -> 'is_correct') <> 'boolean'
      or char_length(btrim(coalesce(answer_item.value ->> 'option_text', ''))) not between 1 and 500
  ) then
    raise exception 'Each quiz option needs valid text and a correct-answer flag' using errcode = '22023';
  end if;

  select course_row.id, quiz_row.id
  into course_key, quiz_key
  from public.lessons as lesson_row
  join public.learning_courses as course_row on course_row.id = lesson_row.course_id
  join public.quiz_lessons as quiz_row on quiz_row.lesson_id = lesson_row.id
  where lesson_row.id = p_lesson_id
    and lesson_row.lesson_type = 'quiz'
    and course_row.instructor_id = auth.uid()
    and course_row.status = 'draft';
  if quiz_key is null then
    raise exception 'Draft quiz configuration not found or is no longer editable' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(course_key);
  select quiz_row.id into quiz_key
  from public.lessons as lesson_row
  join public.learning_courses as course_row on course_row.id = lesson_row.course_id
  join public.quiz_lessons as quiz_row on quiz_row.lesson_id = lesson_row.id
  where lesson_row.id = p_lesson_id and lesson_row.lesson_type = 'quiz'
    and course_row.id = course_key and course_row.instructor_id = auth.uid() and course_row.status = 'draft';
  if quiz_key is null then
    raise exception 'Draft quiz configuration not found or is no longer editable' using errcode = 'P0002';
  end if;

  if p_question_id is null then
    select coalesce(max(question_row.position), 0) + 1
    into next_position
    from public.quiz_questions as question_row
    where question_row.quiz_id = quiz_key;
    insert into public.quiz_questions (quiz_id, question_text, position)
    values (quiz_key, normalized_question, next_position)
    returning id into question_key;
  else
    select question_row.id
    into question_key
    from public.quiz_questions as question_row
    where question_row.id = p_question_id
      and question_row.quiz_id = quiz_key
    for update;
    if question_key is null then
      raise exception 'Quiz question not found' using errcode = 'P0002';
    end if;
    update public.quiz_questions as question_row
    set question_text = normalized_question,
        updated_at = now()
    where question_row.id = question_key
      and question_row.quiz_id = quiz_key;
    delete from public.quiz_options as option_row where option_row.question_id = question_key;
  end if;

  insert into public.quiz_options (question_id, option_text, position, is_correct)
  select question_key,
         btrim(answer_item.value ->> 'option_text'),
         answer_item.ordinality::integer,
         (answer_item.value ->> 'is_correct')::boolean
  from jsonb_array_elements(p_options) with ordinality as answer_item(value, ordinality);

  return query
  select question_key, question_row.position
  from public.quiz_questions as question_row
  where question_row.id = question_key;
end;
$function$;

grant execute on function "public"."upsert_instructor_quiz_question"(bigint, bigint, text, jsonb) to "authenticated", "postgres", "service_role";

revoke all on function "public"."upsert_instructor_quiz_question"(bigint, bigint, text, jsonb) from public;
