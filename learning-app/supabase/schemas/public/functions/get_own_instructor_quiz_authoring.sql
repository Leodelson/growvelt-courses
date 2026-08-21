create or replace function public.get_own_instructor_quiz_authoring (
  p_lesson_id bigint
)
  returns table (
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
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.lessons as lesson_row
    join public.learning_courses as course_row on course_row.id = lesson_row.course_id
    where lesson_row.id = p_lesson_id
      and lesson_row.lesson_type = 'quiz'
      and course_row.instructor_id = auth.uid()
      and course_row.status = 'draft'
  ) then
    raise exception 'Draft quiz lesson not found or is no longer editable' using errcode = 'P0002';
  end if;
  return query
  select quiz_row.id,
         quiz_row.instructions,
         quiz_row.passing_percentage,
         question_row.id,
         question_row.question_text,
         question_row.position,
         option_row.id,
         option_row.option_text,
         option_row.position,
         option_row.is_correct
  from public.quiz_lessons as quiz_row
  left join public.quiz_questions as question_row on question_row.quiz_id = quiz_row.id
  left join public.quiz_options as option_row on option_row.question_id = question_row.id
  where quiz_row.lesson_id = p_lesson_id
  order by question_row.position, question_row.id, option_row.position, option_row.id;
end;
$function$;

grant execute on function "public"."get_own_instructor_quiz_authoring"(bigint) to "authenticated", "postgres", "service_role";

revoke all on function "public"."get_own_instructor_quiz_authoring"(bigint) from public;
