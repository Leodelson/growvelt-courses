create or replace function public.move_instructor_quiz_question (
  p_lesson_id   bigint,
  p_question_id bigint,
  p_direction   text
)
  returns table (
    moved_question_id       bigint,
    moved_question_position integer
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  course_key bigint;
  quiz_key bigint;
  source_position integer;
  target_id bigint;
  target_position integer;
  temporary_position integer;
  normalized_direction text := lower(btrim(p_direction));
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;
  if normalized_direction not in ('up', 'down') then
    raise exception 'Move direction must be up or down' using errcode = '22023';
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
  select question_row.position
  into source_position
  from public.quiz_questions as question_row
  where question_row.id = p_question_id
    and question_row.quiz_id = quiz_key
  for update;
  if source_position is null then
    raise exception 'Quiz question not found' using errcode = 'P0002';
  end if;
  select question_row.id, question_row.position
  into target_id, target_position
  from public.quiz_questions as question_row
  where question_row.quiz_id = quiz_key
    and (
      (normalized_direction = 'up' and question_row.position < source_position)
      or (normalized_direction = 'down' and question_row.position > source_position)
    )
  order by
    case when normalized_direction = 'up' then question_row.position end desc,
    case when normalized_direction = 'down' then question_row.position end asc,
    question_row.id asc
  limit 1
  for update;

  if target_id is not null then
    -- The unique/check constraints remain valid throughout the swap. The
    -- course advisory lock serializes all question-order mutations.
    select coalesce(max(question_row.position), 0) + 1
    into temporary_position
    from public.quiz_questions as question_row
    where question_row.quiz_id = quiz_key;
    update public.quiz_questions as question_row
    set position = temporary_position
    where question_row.id = p_question_id
      and question_row.quiz_id = quiz_key;
    update public.quiz_questions as question_row
    set position = source_position
    where question_row.id = target_id
      and question_row.quiz_id = quiz_key;
    update public.quiz_questions as question_row
    set position = target_position
    where question_row.id = p_question_id
      and question_row.quiz_id = quiz_key;
    source_position := target_position;
  end if;
  return query
  select p_question_id, source_position;
end;
$function$;

grant execute on function "public"."move_instructor_quiz_question"(bigint, bigint, text) to "authenticated", "postgres", "service_role";

revoke all on function "public"."move_instructor_quiz_question"(bigint, bigint, text) from public;
