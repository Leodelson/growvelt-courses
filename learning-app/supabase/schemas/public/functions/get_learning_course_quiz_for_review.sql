create or replace function public.get_learning_course_quiz_for_review (
  p_course_id bigint
)
  returns table (
    course_id          bigint,
    lesson_id          bigint,
    quiz_id            bigint,
    instructions       text,
    passing_percentage integer,
    question_id        bigint,
    question_text      text,
    question_position  integer,
    option_id          bigint,
    option_text        text,
    option_position    integer,
    is_correct         boolean
  )
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
begin
  if auth.uid() is null or not public.is_growvelt_learning_admin() then
    raise exception 'Learning Admin capability required' using errcode = '42501';
  end if;

  if p_course_id is null or p_course_id < 1 then
    raise exception 'Invalid course review reference' using errcode = '22023';
  end if;

  return query
  select
    course_row.id,
    lesson_row.id,
    quiz_row.id,
    quiz_row.instructions,
    quiz_row.passing_percentage,
    question_row.id,
    question_row.question_text,
    question_row.position,
    option_row.id,
    option_row.option_text,
    option_row.position,
    option_row.is_correct
  from public.learning_courses as course_row
  join public.lessons as lesson_row
    on lesson_row.course_id = course_row.id
   and lesson_row.lesson_type = 'quiz'
  join public.quiz_lessons as quiz_row
    on quiz_row.lesson_id = lesson_row.id
   and quiz_row.course_id = course_row.id
  join public.quiz_questions as question_row on question_row.quiz_id = quiz_row.id
  join public.quiz_options as option_row on option_row.question_id = question_row.id
  where course_row.id = p_course_id
    and course_row.status = 'pending_review'
  order by lesson_row.id, question_row.position, question_row.id, option_row.position, option_row.id;
end;
$function$;

grant execute on function "public"."get_learning_course_quiz_for_review"(bigint) to "authenticated", "postgres", "service_role";

revoke all on function "public"."get_learning_course_quiz_for_review"(bigint) from public;
